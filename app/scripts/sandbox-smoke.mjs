// P0 evidence assessor. This module never provisions Windows SRT.
import { spawn, execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { encodeLaunchFrame, LAUNCH_MARKER } from './sandbox-launch-frame.mjs'

const execFileAsync = promisify(execFile)
const fixtureMarker = 'orca-denied-fixture'
const probeMarker = 'orca-srt-probe-v1'
const probeSource = fileURLToPath(new URL('./sandbox-probe.mjs', import.meta.url))
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const safeCodes = new Set([
  'EACCES',
  'EPERM',
  'ENOENT',
  'EADDRINUSE',
  'EADDRNOTAVAIL',
  'ABORTED',
  'PROBE_TIMEOUT',
  'RUNNER_EXIT_TIMEOUT',
  'CHILD_READY_TIMEOUT',
  'CHILD_RUNNER_EXIT_TIMEOUT',
  'RUNNER_CLEANUP_TIMEOUT',
  'RESET_TIMEOUT',
  'RUNNER_START_FAILED',
  'RUNNER_INPUT_FAILED',
  'PROBE_OUTPUT_LIMIT',
  'PROBE_INVALID_JSON',
  'PROBE_NO_RESULT',
  'PROBE_EXIT_FAILED',
  'srt_win_not_found',
  'spawn_failed',
  'srt_win_timeout',
  'srt_win_nonzero',
  'srt_win_bad_json',
  'bin_shell_invalid',
  'wfp_verify_bind_failed',
  'wfp_verify_unparseable',
  'wfp_fence_inactive',
  'wfp_verify_inconclusive',
  'acl_stamp_failed',
  'acl_grant_failed',
  'argv_too_long',
  'not_provisioned',
  'mapped_drive_cwd'
])
const codeOf = (error) => (safeCodes.has(error?.code) ? error.code : 'SMOKE_OPERATION_FAILED')
const deniedAccess = (value) => value?.ok === false && ['EACCES', 'EPERM'].includes(value.errorCode)
const blockedSocket = (value) =>
  value?.connected === false && ['EACCES', 'EPERM', 'ETIMEDOUT'].includes(value.errorCode)

export function assessSmoke(evidence = {}) {
  const { echo, fs, hostFiles, network, listeners, child, acl, cleanup } = evidence
  const checks = [
    [
      'transport.srt-frame',
      echo?.markerMatches === true &&
        echo.argsMatch === true &&
        echo.cwdMatches === true &&
        echo.fakeEnvMatches === true
    ],
    [
      'filesystem.allowed',
      fs?.allowWrite?.ok === true &&
        fs?.allowRead?.ok === true &&
        hostFiles?.allowedContentMatches === true
    ],
    [
      'filesystem.denied-read',
      deniedAccess(fs?.denyRead) && hostFiles?.deniedContentUnchanged === true
    ],
    [
      'filesystem.denied-write',
      deniedAccess(fs?.denyWrite) && hostFiles?.deniedWriteAbsent === true
    ],
    [
      'network.allowed-proxy',
      network?.allowed?.ok === true && network.allowed.status === 200 && listeners?.allowedHits > 0
    ],
    [
      'network.denied-proxy',
      network?.denied?.ok === false && network.denied.status === 403 && listeners?.deniedHits === 0
    ],
    ['network.direct-ipv4', listeners?.ipv4 === true && blockedSocket(network?.directIPv4)],
    ['network.direct-ipv6', listeners?.ipv6 === true && blockedSocket(network?.directIPv6)],
    [
      'process.nested-exit',
      child?.observedAlive === true &&
        child.descendantCount >= 2 &&
        child.deadAfterRunnerExit === true
    ],
    [
      'cleanup.acl-restored',
      Array.isArray(acl?.before) &&
        acl.before.length > 0 &&
        Array.isArray(acl?.after) &&
        acl.before.length === acl.after.length &&
        acl.before.every(
          (sddl, index) => typeof sddl === 'string' && sddl.length > 0 && sddl === acl.after[index]
        )
    ],
    ['cleanup.reset', cleanup?.resetCompleted === true],
    ['cleanup.listeners', cleanup?.listenersClosed === true],
    ['cleanup.runner', cleanup?.runnerClosed === true]
  ].map(([id, passed]) => ({ id, passed: Boolean(passed) }))
  return { success: checks.every((check) => check.passed), checks }
}

export async function createSmokeFixture() {
  const parent = await realpath(tmpdir())
  const root = await mkdtemp(path.join(parent, 'orca-srt-smoke-'))
  const token = randomUUID()
  const ownerFile = path.join(root, '.orca-smoke-owner')
  const fixture = {
    root,
    parent,
    token,
    ownerFile,
    allowed: path.join(root, 'allowed'),
    denied: path.join(root, 'denied'),
    assets: path.join(root, 'assets'),
    denyReadFile: path.join(root, 'denied', 'read.txt'),
    denyWriteFile: path.join(root, 'denied', 'new.txt')
  }
  await writeFile(ownerFile, token, { flag: 'wx' })
  try {
    for (const dir of [fixture.allowed, fixture.denied, fixture.assets]) await mkdir(dir)
    await writeFile(fixture.denyReadFile, fixtureMarker, { flag: 'wx' })
    return fixture
  } catch (error) {
    await removeSmokeFixture(fixture)
    throw error
  }
}

export async function removeSmokeFixture(fixture) {
  const root = path.resolve(fixture.root)
  const expectedOwner = path.join(root, '.orca-smoke-owner')
  const valid =
    path.dirname(root) === fixture.parent &&
    path.basename(root).startsWith('orca-srt-smoke-') &&
    fixture.ownerFile === expectedOwner &&
    !(await lstat(root)).isSymbolicLink() &&
    (await realpath(root)) === root &&
    (await readFile(expectedOwner, 'utf8')) === fixture.token
  if (!valid) throw new Error('FIXTURE_OWNERSHIP')
  await rm(root, { recursive: true, force: true })
}

export async function createSmokeListeners() {
  const servers = []
  let allowedHits = 0
  let deniedHits = 0
  const listen = async (host, handler) => {
    const server = http.createServer(handler)
    servers.push(server)
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen({ host, port: 0, ...(host === '::1' ? { ipv6Only: true } : {}) }, resolve)
    })
    const port = server.address().port
    if (port >= 60080 && port <= 60089) {
      await new Promise((resolve) => server.close(resolve))
      servers.splice(servers.indexOf(server), 1)
      return listen(host, handler)
    }
    return port
  }
  const close = async () => {
    const results = await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolve) => {
            if (!server.listening) return resolve(true)
            server.closeAllConnections()
            server.close((error) => resolve(!error))
          })
      )
    )
    return results.every(Boolean)
  }
  try {
    // Port-specific policy separates real allowed and denied loopback listeners.
    const allowed = await listen('127.0.0.1', (_req, res) => {
      allowedHits += 1
      res.end('ok')
    })
    const denied = await listen('127.0.0.1', (_req, res) => {
      deniedHits += 1
      res.end('unexpected')
    })
    const ipv6 = await listen('::1', (_req, res) => res.end('direct'))
    return {
      allowedUrl: `http://127.0.0.1:${allowed}/allowed`,
      deniedUrl: `http://127.0.0.1:${denied}/denied`,
      allowedHost: `127.0.0.1:${allowed}`,
      deniedHost: `127.0.0.1:${denied}`,
      directIPv4: { host: '127.0.0.1', port: denied },
      directIPv6: { host: '::1', port: ipv6 },
      evidence: () => ({
        ipv4: servers[0].listening && servers[1].listening,
        ipv6: servers[2].listening,
        allowedHits,
        deniedHits
      }),
      close
    }
  } catch (error) {
    await close()
    throw error
  }
}

export async function captureFixtureAcl(paths) {
  // Paths travel as data, never interpolated into PowerShell source.
  const shell = path.join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  const command =
    "$ErrorActionPreference='Stop'; $items=@($env:ORCA_SMOKE_ACL_PATHS | ConvertFrom-Json); $result=@($items | ForEach-Object { (Get-Acl -LiteralPath $_).Sddl }); ConvertTo-Json -InputObject $result -Compress"
  const { stdout } = await execFileAsync(
    shell,
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      env: {
        ...process.env,
        PSModulePath: path.join(path.dirname(shell), 'Modules'),
        ORCA_SMOKE_ACL_PATHS: JSON.stringify(paths)
      },
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 128 * 1024
    }
  )
  const values = JSON.parse(stdout.replace(/^\uFEFF/, '').trim())
  if (
    !Array.isArray(values) ||
    values.length !== paths.length ||
    values.some((value) => typeof value !== 'string' || !value)
  ) {
    throw new Error('ACL_OBSERVATION_INVALID')
  }
  return values
}

const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code !== 'ESRCH'
  }
}

async function waitDead(pids, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (pids.some(alive) && Date.now() < deadline) await pause(50)
  return pids.every((pid) => !alive(pid))
}

function bounded(promise, timeoutMs, code) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(code), { code })), timeoutMs)
    })
  ]).finally(() => clearTimeout(timer))
}

function startWrappedProbe(wrapped, frame, runners) {
  if (!Array.isArray(wrapped.argv) || !path.isAbsolute(wrapped.argv[0]) || !wrapped.env)
    throw new Error('INVALID_SRT_WRAPPER')
  const child = spawn(wrapped.argv[0], wrapped.argv.slice(1), {
    env: wrapped.env,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let settled = false
  let output = Buffer.alloc(0)
  let stderrBytes = 0
  let resolveResult
  let rejectResult
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  // A failing process can close before the caller awaits result.
  result.catch(() => {})
  const fail = (code) => {
    if (!settled) {
      settled = true
      rejectResult(Object.assign(new Error(code), { code }))
    }
  }
  const closed = new Promise((resolve) => {
    child.once('error', () => {
      fail('RUNNER_START_FAILED')
      resolve({ closed: true, code: null })
    })
    child.once('close', (code) => {
      if (!settled) fail('PROBE_NO_RESULT')
      resolve({ closed: true, code })
    })
  })
  const running = {
    child,
    closed,
    result,
    get stderrBytes() {
      return stderrBytes
    }
  }
  runners.push(running)
  child.stdin.on('error', () => fail('RUNNER_INPUT_FAILED'))
  child.stderr.on('data', (bytes) => {
    stderrBytes += bytes.length
  })
  child.stdout.on('data', (bytes) => {
    if (settled) return
    if (output.length + bytes.length > 64 * 1024) {
      fail('PROBE_OUTPUT_LIMIT')
      child.kill()
      return
    }
    output = Buffer.concat([output, bytes])
    const end = output.indexOf(10)
    if (end < 0) return
    try {
      const value = JSON.parse(output.subarray(0, end).toString('utf8'))
      settled = true
      resolveResult(value)
    } catch {
      fail('PROBE_INVALID_JSON')
      child.kill()
    }
  })
  child.stdin.end(frame)
  return running
}

// The optional manager is a narrow test seam for initialization/cleanup failures; normal callers
// use the pinned public SRT manager. Tests never replace process/ACL results with a sandbox claim.
export async function runSandboxSmoke(
  { srtWinPath, launcherPath, signal },
  { manager: injectedManager, resetTimeoutMs = 20_000 } = {}
) {
  if (process.platform !== 'win32') throw new Error('WINDOWS_REQUIRED')
  if (
    ![srtWinPath, launcherPath].every(
      (value) => typeof value === 'string' && path.isAbsolute(value)
    )
  )
    throw new Error('ABSOLUTE_EXECUTABLE_REQUIRED')
  const manager = injectedManager ?? (await import('@anthropic-ai/sandbox-runtime')).SandboxManager
  const controller = new AbortController()
  const runners = []
  const abort = () => {
    controller.abort()
    for (const running of runners) if (running.child.exitCode === null) running.child.kill()
  }
  const throwIfAborted = () => {
    if (controller.signal.aborted) throw Object.assign(new Error('ABORTED'), { code: 'ABORTED' })
  }
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const failures = []
  const evidence = {
    cleanup: { resetCompleted: false, listenersClosed: false, runnerClosed: false }
  }
  let fixture
  let listeners
  let aclPaths
  let initialized = false
  let stage = 'fixture'
  let childPids = []
  let childExecutionStarted = false
  const record = (at, error) => failures.push({ stage: at, code: codeOf(error) })
  try {
    throwIfAborted()
    fixture = await createSmokeFixture()
    const node = path.join(fixture.assets, 'node.exe')
    const launcher = path.join(fixture.assets, 'launcher.exe')
    const probe = path.join(fixture.assets, 'sandbox-probe.mjs')
    // Copies avoid granting read access to the developer's runtime/repository trees.
    await copyFile(process.execPath, node)
    await copyFile(launcherPath, launcher)
    await copyFile(probeSource, probe)
    stage = 'listeners'
    listeners = await createSmokeListeners()
    aclPaths = [
      fixture.root,
      fixture.allowed,
      fixture.denied,
      fixture.denyReadFile,
      fixture.assets,
      node,
      launcher,
      probe
    ]
    stage = 'acl-before'
    evidence.acl = { before: await captureFixtureAcl(aclPaths) }
    throwIfAborted()
    stage = 'initialize'
    initialized = true // partial initialization also needs reset
    await manager.initialize({
      filesystem: {
        allowRead: [fixture.assets, fixture.allowed],
        allowWrite: [fixture.allowed],
        denyRead: [fixture.denied],
        denyWrite: [fixture.denied]
      },
      network: {
        allowedDomains: [listeners.allowedHost],
        deniedDomains: [listeners.deniedHost],
        strictAllowlist: true
      },
      windows: { srtWin: { path: srtWinPath } }
    })
    const launch = async (mode, options) => {
      throwIfAborted()
      const wrapped = await manager.wrapWithSandboxArgv(
        LAUNCH_MARKER,
        { exe: launcher, args: [] },
        undefined,
        controller.signal,
        fixture.allowed
      )
      throwIfAborted()
      const frame = encodeLaunchFrame({
        executable: node,
        cwd: fixture.allowed,
        args: [probe, mode, JSON.stringify(options)],
        env: { ORCA_SANDBOX_TEST: 'fake-p0-key' }
      })
      if (mode === 'child') childExecutionStarted = true
      return startWrappedProbe(wrapped, frame, runners)
    }
    const run = async (mode, options) => {
      const running = await launch(mode, options)
      const result = await bounded(running.result, 30_000, 'PROBE_TIMEOUT')
      const exit = await bounded(running.closed, 10_000, 'RUNNER_EXIT_TIMEOUT')
      if (exit.code !== 0)
        throw Object.assign(new Error('PROBE_EXIT_FAILED'), { code: 'PROBE_EXIT_FAILED' })
      return result
    }
    stage = 'echo'
    const trickyArgs = ['', '한글 공백', 'quote"inside', 'C:\\trailing\\', '&|<>^%!']
    const echoed = await run('echo', { args: trickyArgs })
    evidence.echo = {
      markerMatches: echoed.marker === probeMarker,
      argsMatch: JSON.stringify(echoed.argv) === JSON.stringify(trickyArgs),
      cwdMatches:
        typeof echoed.cwd === 'string' &&
        path.resolve(echoed.cwd).toLowerCase() === fixture.allowed.toLowerCase(),
      fakeEnvMatches: echoed.env?.ORCA_SANDBOX_TEST === 'fake-p0-key'
    }
    stage = 'filesystem'
    evidence.fs = await run('fs', {
      allowRoot: fixture.allowed,
      denyReadFile: fixture.denyReadFile,
      denyWriteFile: fixture.denyWriteFile
    })
    const allowFile = evidence.fs.allowFile
    evidence.hostFiles = {
      allowedContentMatches:
        typeof allowFile === 'string' &&
        path.dirname(allowFile) === fixture.allowed &&
        (await readFile(allowFile, 'utf8').catch(() => null)) === probeMarker,
      deniedContentUnchanged: (await readFile(fixture.denyReadFile, 'utf8')) === fixtureMarker,
      deniedWriteAbsent: await lstat(fixture.denyWriteFile).then(
        () => false,
        (error) => error.code === 'ENOENT'
      )
    }
    stage = 'network'
    evidence.network = await run('network', {
      allowedUrl: listeners.allowedUrl,
      deniedUrl: listeners.deniedUrl,
      directIPv4: listeners.directIPv4,
      directIPv6: listeners.directIPv6
    })
    evidence.listeners = listeners.evidence()
    stage = 'child'
    const running = await launch('child', {
      depth: 2,
      lifetimeMs: 120_000,
      independentDescendants: true
    })
    const observation = await bounded(running.result, 20_000, 'CHILD_READY_TIMEOUT')
    if (
      observation.mode !== 'child' ||
      !Array.isArray(observation.pids) ||
      observation.pids.length !== 3 ||
      new Set(observation.pids).size !== 3 ||
      observation.pids.some((pid) => !Number.isInteger(pid) || pid <= 0 || pid === process.pid)
    )
      throw new Error('CHILD_OBSERVATION_INVALID')
    childPids = observation.pids
    evidence.child = {
      observedAlive: childPids.every(alive),
      descendantCount: childPids.length - 1,
      deadAfterRunnerExit: false
    }
    // Terminate the SRT runner, not the probe: job ownership must kill its descendants.
    running.child.kill('SIGKILL')
    await bounded(running.closed, 5000, 'CHILD_RUNNER_EXIT_TIMEOUT')
    evidence.child.deadAfterRunnerExit = await waitDead(childPids)
  } catch (error) {
    record(stage, controller.signal.aborted ? { code: 'ABORTED' } : error)
  } finally {
    controller.abort()
    signal?.removeEventListener('abort', abort)
    for (const running of runners) if (running.child.exitCode === null) running.child.kill()
    evidence.cleanup.runnerClosed = true
    for (const running of runners) {
      try {
        await bounded(running.closed, 5000, 'RUNNER_CLEANUP_TIMEOUT')
      } catch (error) {
        evidence.cleanup.runnerClosed = false
        record('runner-cleanup', error)
      }
    }
    if (initialized) {
      try {
        await bounded(manager.reset(), resetTimeoutMs, 'RESET_TIMEOUT')
        evidence.cleanup.resetCompleted = true
      } catch (error) {
        record('reset', error)
      }
    }
    if (aclPaths && evidence.acl) {
      try {
        evidence.acl.after = await captureFixtureAcl(aclPaths)
      } catch (error) {
        record('acl-after', error)
      }
    }
    if (listeners) {
      evidence.listeners ??= listeners.evidence()
      try {
        evidence.cleanup.listenersClosed = await listeners.close()
      } catch (error) {
        record('listener-cleanup', error)
      }
    }
    // Residual PID cleanup is distinct from the earlier job-kill observation and cannot fix it.
    const remaining = childPids.filter(alive)
    for (const pid of remaining) {
      try {
        process.kill(pid)
      } catch {
        /* reported below */
      }
    }
    evidence.cleanup.childrenObservationComplete = !childExecutionStarted || childPids.length === 3
    const observedChildrenDead = await waitDead(remaining)
    evidence.cleanup.residualChildren = evidence.cleanup.childrenObservationComplete
      ? !observedChildrenDead
      : null
    if (fixture) {
      const aclRestored =
        evidence.acl?.before?.length > 0 &&
        evidence.acl?.after?.length === evidence.acl.before.length &&
        evidence.acl.before.every((value, index) => value === evidence.acl.after[index])
      const safeToRemove =
        evidence.cleanup.runnerClosed &&
        evidence.cleanup.residualChildren === false &&
        (!initialized || (evidence.cleanup.resetCompleted && aclRestored))
      evidence.cleanup.fixtureRemoved = false
      if (safeToRemove) {
        try {
          await removeSmokeFixture(fixture)
          evidence.cleanup.fixtureRemoved = true
        } catch (error) {
          record('fixture-cleanup', error)
        }
      }
    }
  }
  const result = assessSmoke(evidence)
  const aclHashes = (values) =>
    values?.map((value) => createHash('sha256').update(value).digest('hex')) ?? []
  return {
    ...result,
    success:
      result.success &&
      failures.length === 0 &&
      evidence.cleanup.fixtureRemoved === true &&
      evidence.cleanup.residualChildren === false,
    failures,
    ...(!evidence.cleanup.fixtureRemoved && fixture ? { retainedFixture: fixture.root } : {}),
    cleanup: evidence.cleanup,
    observations: {
      echo: evidence.echo ?? null,
      filesystem: evidence.fs
        ? {
            allowWrite: evidence.fs.allowWrite,
            allowRead: evidence.fs.allowRead,
            denyRead: evidence.fs.denyRead,
            denyWrite: evidence.fs.denyWrite
          }
        : null,
      hostFiles: evidence.hostFiles ?? null,
      network: evidence.network ?? null,
      listeners: evidence.listeners ?? null,
      child: evidence.child ?? null,
      aclBefore: aclHashes(evidence.acl?.before),
      aclAfter: aclHashes(evidence.acl?.after)
    },
    limitations: [
      'P0_ONLY_APP_NOT_CONNECTED',
      'FIXTURE_SCOPE_ONLY',
      'SHARED_SANDBOX_SID',
      'DNS_NOT_PROVEN_BLOCKED'
    ]
  }
}
