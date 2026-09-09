import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createHash } from 'node:crypto'

const smoke = await import('./sandbox-smoke.mjs')

test('cleanup never terminates a process by a sampled PID', { timeout: 20_000 }, async (t) => {
  const kill = t.mock.method(process, 'kill', () => true)
  const pids = [4000000000, 4000000001, 4000000002]
  const identities = pids.map((pid) => ({ pid, createdAt: '639243000000000000' }))
  let cleanupStarted = false
  let cleanupReads = 0
  const manager = {
    initialize: async () => {},
    reset: async () => {
      cleanupStarted = true
    },
    wrapWithSandboxArgv: async (_command, shell) => ({
      argv: [
        process.execPath,
        '-e',
        shell.args[1] === 'child'
          ? `console.log(JSON.stringify({mode:'child',pids:${JSON.stringify(pids)}}));setInterval(()=>{},1000)`
          : "process.stdin.resume();process.stdin.on('end',()=>console.log('{}'))"
      ],
      env: { ...process.env }
    })
  }
  const report = await smoke.runSandboxSmoke(
    { srtWinPath: process.execPath, diagnosticDirect: true },
    {
      manager,
      observeProcesses: async () => (cleanupStarted && ++cleanupReads > 1 ? [] : identities)
    }
  )
  assert.equal(report.observations.child.deadAfterRunnerExit, false)
  assert.equal(report.cleanup.residualChildren, false)
  assert.equal(report.cleanup.fixtureRemoved, true)
  assert.equal(kill.mock.callCount(), 0, 'CIM snapshot grants no stable termination handle')
})

test(
  'a failed process identity observation retains the fixture instead of inferring child exit',
  { skip: process.platform !== 'win32' },
  async () => {
    const manager = {
      initialize: async () => {},
      reset: async () => {},
      wrapWithSandboxArgv: async (_command, shell) => {
        const mode = shell.args[1]
        const source =
          mode === 'child'
            ? "const spawn=require('node:child_process').spawn;const kids=[1,2].map(()=>spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true}));process.stdin.resume();console.log(JSON.stringify({mode:'child',pids:[process.pid,...kids.map(c=>c.pid)]}));setInterval(()=>{},1000)"
            : "process.stdin.resume();process.stdin.on('end',()=>console.log('{}'))"
        return { argv: [process.execPath, '-e', source], env: { ...process.env } }
      }
    }
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath, diagnosticDirect: true },
      {
        manager,
        observeProcesses: async () => {
          throw Object.assign(new Error('private details'), { code: 'PROCESS_OBSERVATION_FAILED' })
        }
      }
    )
    try {
      assert.equal(
        report.failures.some((failure) => failure.code === 'PROCESS_OBSERVATION_FAILED'),
        true
      )
      assert.equal(report.success, false)
      assert.equal(report.cleanup.childrenObservationComplete, false)
      assert.equal(report.cleanup.residualChildren, null)
      assert.equal(report.cleanup.fixtureRemoved, false)
      assert.equal(typeof report.retainedFixture, 'string')
    } finally {
      if (report.retainedFixture) {
        const root = report.retainedFixture
        const ownerFile = path.join(root, '.orca-smoke-owner')
        await smoke.removeSmokeFixture({
          root,
          parent: await import('node:fs/promises').then((fs) => fs.realpath(tmpdir())),
          ownerFile,
          token: await readFile(ownerFile, 'utf8')
        })
      }
    }
  }
)

test('an explicit fixture parent confines the owned root and cleanup to that directory', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'smoke-parent-test-'))
  let fixture
  try {
    fixture = await smoke.createSmokeFixture(parent)
    assert.equal(path.dirname(fixture.root), parent)
    await smoke.removeSmokeFixture(fixture)
    fixture = undefined
  } finally {
    if (fixture) await smoke.removeSmokeFixture(fixture)
    await rm(parent, { recursive: true, force: true })
  }
})

test(
  'direct diagnostics continue after missing stdin and cannot claim bootstrap success',
  { skip: process.platform !== 'win32' },
  async () => {
    const modes = []
    const manager = {
      initialize: async (config) => {
        assert.equal(config.filesystem.denyRead.length, 1)
        assert.deepEqual(config.filesystem.denyWrite, [])
      },
      reset: async () => {},
      wrapWithSandboxArgv: async (command, shell, _config, _signal, cwd) => {
        const options = JSON.parse(command)
        const mode = shell.args[1]
        assert.equal(path.basename(shell.exe), 'node.exe')
        assert.equal(path.basename(shell.args[0]), 'sandbox-probe.mjs')
        modes.push(mode)
        const result =
          mode === 'stdin'
            ? { mode, bytes: 0, sha256: createHash('sha256').update('').digest('hex') }
            : mode === 'echo'
              ? {
                  mode,
                  marker: 'orca-srt-probe-v1',
                  argv: options.args,
                  cwd,
                  env: { ORCA_SANDBOX_TEST: 'fake-p0-key' }
                }
              : mode === 'child'
                ? { mode, pids: [] }
                : { mode }
        return {
          argv: [
            process.execPath,
            '-e',
            "process.stdin.resume();process.stdin.on('end',()=>console.log(process.argv[1]))",
            JSON.stringify(result)
          ],
          env: { ...process.env }
        }
      }
    }
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath, diagnosticDirect: true },
      { manager }
    )
    try {
      assert.deepEqual(modes, ['stdin', 'echo', 'fs', 'network', 'child'])
      assert.equal(report.executionPath, 'diagnostic-direct')
      assert.equal(report.success, false)
      assert.equal(report.checks.find((check) => check.id === 'transport.srt-frame').passed, false)
      assert.equal(
        report.checks.find((check) => check.id === 'transport.stdin-bytes').passed,
        false
      )
      assert.deepEqual(report.observations.stdin, { bytes: 0, hashMatches: false })
      assert.deepEqual(report.observations.observedPids, [])
      assert.equal(report.observations.runnerTermination.requested, false)
      assert.equal(report.cleanup.childrenObservationComplete, false)
      assert.equal(report.cleanup.residualChildren, null)
      assert.equal(report.cleanup.fixtureRemoved, false)
      assert.equal(typeof report.retainedFixture, 'string')
    } finally {
      if (report.retainedFixture) {
        const root = report.retainedFixture
        const ownerFile = path.join(root, '.orca-smoke-owner')
        await smoke.removeSmokeFixture({
          root,
          parent: await import('node:fs/promises').then((fs) => fs.realpath(tmpdir())),
          ownerFile,
          token: await readFile(ownerFile, 'utf8')
        })
      }
    }
  }
)

test(
  'direct diagnostic sends the fake stdin bytes to an ordinary process in the chosen fixture parent',
  { skip: process.platform !== 'win32' },
  async () => {
    const parent = await mkdtemp(path.join(tmpdir(), 'smoke-direct-parent-'))
    const modes = []
    const manager = {
      initialize: async () => {},
      reset: async () => {},
      wrapWithSandboxArgv: async (command, shell, _config, _signal, cwd) => {
        assert.equal(path.dirname(path.dirname(cwd)), parent)
        const mode = shell.args[1]
        modes.push(mode)
        if (mode !== 'stdin')
          throw Object.assign(new Error('stop after observing transport'), { code: 'EACCES' })
        assert.equal(command, '{}')
        return {
          argv: [
            process.execPath,
            '-e',
            "const chunks=[];process.stdin.on('data',b=>chunks.push(b));process.stdin.on('end',()=>{const b=Buffer.concat(chunks);console.log(JSON.stringify({mode:'stdin',bytes:b.length,sha256:require('node:crypto').createHash('sha256').update(b).digest('hex')}))})"
          ],
          env: { ...process.env }
        }
      }
    }
    try {
      const report = await smoke.runSandboxSmoke(
        { srtWinPath: process.execPath, diagnosticDirect: true, fixtureParent: parent },
        { manager }
      )
      assert.deepEqual(modes, ['stdin', 'echo'])
      assert.deepEqual(report.observations.stdin, {
        bytes: Buffer.byteLength('orca-srt-stdin-v1\0후속입력\n'),
        hashMatches: true
      })
      assert.equal(report.checks.find((check) => check.id === 'transport.stdin-bytes').passed, true)
      assert.equal(report.checks.find((check) => check.id === 'transport.srt-frame').passed, false)
      assert.equal(report.success, false)
      assert.equal(report.cleanup.fixtureRemoved, true)
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  }
)

test(
  'ordinary failing runner uses the requested cwd and reports only fixed diagnostic codes',
  { skip: process.platform !== 'win32' },
  async () => {
    const stderr =
      [
        'orca-launcher: CREATE_FAILED 5',
        'orca-launcher: PRIVATE_TOKEN_VALUE 123',
        JSON.stringify({
          code: 'mapped_drive_cwd',
          message: 'PRIVATE_MESSAGE',
          drive: 'PRIVATE_PATH'
        }),
        JSON.stringify({ code: 'private_code', env: 'PRIVATE_ENV' }),
        'https://private-user:PRIVATE_PASSWORD@localhost'
      ].join('\n') + '\n'
    const manager = {
      initialize: async () => {},
      reset: async () => {},
      wrapWithSandboxArgv: async (_marker, _shell, _config, _signal, cwd) => ({
        argv: [
          process.execPath,
          '-e',
          "process.stdin.resume(); process.stdin.on('end',()=>{const message=process.cwd()===process.argv[2]?process.argv[1]:'orca-launcher: INVALID_CWD\\n';process.stderr.write(message,()=>{process.exitCode=125})})",
          stderr,
          cwd
        ],
        env: { ...process.env }
      })
    }
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath },
      { manager }
    )
    assert.equal(report.success, false)
    assert.deepEqual(report.diagnostics, [
      {
        mode: 'echo',
        exitCode: 125,
        stderrBytes: Buffer.byteLength(stderr),
        bootstrapErrors: [{ code: 'CREATE_FAILED', win32Error: 5 }],
        srtErrorCodes: ['mapped_drive_cwd']
      }
    ])
    assert.equal(JSON.stringify(report).includes('PRIVATE'), false)
    assert.equal(report.cleanup.fixtureRemoved, true)
  }
)
const good = () => ({
  echo: { markerMatches: true, argsMatch: true, cwdMatches: true, fakeEnvMatches: true },
  fs: {
    allowWrite: { ok: true },
    allowRead: { ok: true, bytes: 17 },
    denyRead: { ok: false, errorCode: 'EACCES' },
    denyWrite: { ok: false, errorCode: 'EPERM' }
  },
  hostFiles: { allowedContentMatches: true, deniedContentUnchanged: true, deniedWriteAbsent: true },
  network: {
    allowed: { ok: true, status: 200 },
    denied: { ok: false, status: 403 },
    directIPv4: { connected: false, errorCode: 'ETIMEDOUT' },
    directIPv6: { connected: false, errorCode: 'EACCES' }
  },
  listeners: { ipv4: true, ipv6: true, allowedHits: 1, deniedHits: 0 },
  child: { observedAlive: true, descendantCount: 2, deadAfterRunnerExit: true },
  acl: { before: ['a', 'b'], after: ['a', 'b'] },
  cleanup: { resetCompleted: true, listenersClosed: true, runnerClosed: true }
})

test(
  'a child runner that exits before reporting PIDs leaves descendant cleanup unknown',
  { skip: process.platform !== 'win32' },
  async () => {
    let launches = 0
    const manager = {
      initialize: async () => {},
      wrapWithSandboxArgv: async () => {
        launches += 1
        // Ordinary processes exercise orchestration only. The fourth runner exits without a
        // child observation; earlier empty results are deliberately not sandbox success evidence.
        const source =
          launches === 4
            ? 'process.stdin.resume()'
            : "process.stdin.resume(); process.stdin.on('end',()=>console.log('{}'))"
        return { argv: [process.execPath, '-e', source], env: { ...process.env } }
      },
      reset: async () => {}
    }
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath },
      { manager }
    )
    try {
      assert.equal(launches, 4)
      assert.equal(report.success, false)
      assert.deepEqual(report.failures, [{ stage: 'child', code: 'PROBE_NO_RESULT' }])
      assert.equal(report.cleanup.runnerClosed, true)
      assert.equal(report.cleanup.resetCompleted, true)
      assert.equal(report.cleanup.childrenObservationComplete, false)
      assert.equal(report.cleanup.residualChildren, null)
      assert.equal(report.cleanup.fixtureRemoved, false)
      assert.equal(typeof report.retainedFixture, 'string')
    } finally {
      if (report.retainedFixture) {
        const root = report.retainedFixture
        const ownerFile = path.join(root, '.orca-smoke-owner')
        await smoke.removeSmokeFixture({
          root,
          parent: await import('node:fs/promises').then((fs) => fs.realpath(tmpdir())),
          ownerFile,
          token: await readFile(ownerFile, 'utf8')
        })
      }
    }
  }
)

test('observed filesystem, network, child and ACL results close the smoke report', () => {
  assert.equal(typeof smoke.assessSmoke, 'function', 'smoke assessor must exist')
  assert.equal(smoke.assessSmoke(good()).success, true)
})

test('missing evidence, ordinary filesystem errors and proxy authentication failure cannot pass', () => {
  assert.equal(typeof smoke.assessSmoke, 'function')
  const cases = [
    {},
    { ...good(), diagnosticDirect: true },
    { ...good(), echo: undefined },
    { ...good(), echo: { ...good().echo, fakeEnvMatches: false } },
    { ...good(), fs: { ...good().fs, denyRead: { ok: false, errorCode: 'ENOENT' } } },
    { ...good(), fs: { ...good().fs, denyWrite: { ok: false, errorCode: 'EEXIST' } } },
    { ...good(), network: { ...good().network, denied: { ok: false, status: 407 } } },
    {
      ...good(),
      network: { ...good().network, directIPv6: { connected: false, errorCode: 'ECONNREFUSED' } }
    },
    { ...good(), listeners: { ...good().listeners, ipv6: false } },
    { ...good(), listeners: { ...good().listeners, deniedHits: 1 } },
    { ...good(), hostFiles: { ...good().hostFiles, deniedWriteAbsent: false } },
    { ...good(), child: { ...good().child, descendantCount: 0 } },
    { ...good(), child: { ...good().child, deadAfterRunnerExit: false } },
    { ...good(), acl: { before: [], after: [] } },
    { ...good(), acl: { before: ['a'], after: ['b'] } },
    { ...good(), cleanup: { ...good().cleanup, resetCompleted: false } }
  ]
  for (const evidence of cases) assert.equal(smoke.assessSmoke(evidence).success, false)
})

test('check results stay safe and never serialize arbitrary input payloads', () => {
  assert.equal(typeof smoke.assessSmoke, 'function')
  const evidence = { ...good(), secret: 'do-not-copy-this' }
  const result = smoke.assessSmoke(evidence)
  assert.equal(JSON.stringify(result).includes('do-not-copy-this'), false)
  assert.ok(
    result.checks.every((row) => typeof row.id === 'string' && typeof row.passed === 'boolean')
  )
})

test('owned fixture cleanup refuses a replaced ownership marker and preserves unrelated files', async () => {
  assert.equal(typeof smoke.createSmokeFixture, 'function')
  const fixture = await smoke.createSmokeFixture()
  try {
    await writeFile(fixture.ownerFile, 'different-owner')
    await assert.rejects(smoke.removeSmokeFixture(fixture), /FIXTURE_OWNERSHIP/)
    assert.equal(await readFile(fixture.denyReadFile, 'utf8'), 'orca-denied-fixture')
  } finally {
    await writeFile(fixture.ownerFile, fixture.token)
    await smoke.removeSmokeFixture(fixture)
  }
  const unrelated = await mkdtemp(path.join(tmpdir(), 'unrelated-smoke-test-'))
  try {
    await assert.rejects(
      smoke.removeSmokeFixture({ ...fixture, root: unrelated }),
      /FIXTURE_OWNERSHIP/
    )
  } finally {
    await rm(unrelated, { recursive: true, force: true })
  }
})

test('network fixtures serve real loopback requests and fully close their listeners', async () => {
  assert.equal(typeof smoke.createSmokeListeners, 'function')
  const listeners = await smoke.createSmokeListeners()
  try {
    await new Promise((resolve, reject) => {
      http
        .get(listeners.allowedUrl, (res) => {
          res.resume()
          res.once('end', resolve)
        })
        .once('error', reject)
    })
    assert.equal(listeners.evidence().allowedHits, 1)
    assert.equal(listeners.evidence().deniedHits, 0)
    assert.equal(listeners.evidence().ipv4, true)
    assert.equal(listeners.evidence().ipv6, true)
    for (const port of [
      new URL(listeners.allowedUrl).port,
      new URL(listeners.deniedUrl).port,
      listeners.directIPv6.port
    ]) {
      assert.equal(Number(port) >= 60080 && Number(port) <= 60089, false)
    }
  } finally {
    assert.equal(await listeners.close(), true)
  }
})

test(
  'failed SRT initialize never launches a probe and reset is still attempted',
  { skip: process.platform !== 'win32' },
  async () => {
    assert.equal(typeof smoke.runSandboxSmoke, 'function')
    let reset = 0
    const manager = {
      initialize: async () => {
        throw Object.assign(new Error('SECRET-MUST-NOT-LOG'), { code: 'SRT_UNAVAILABLE' })
      },
      wrapWithSandboxArgv: async () => assert.fail('must not launch after failed initialize'),
      reset: async () => {
        reset += 1
      }
    }
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath },
      { manager }
    )
    assert.equal(report.success, false)
    assert.equal(reset, 1)
    assert.equal(
      report.failures.some((failure) => failure.stage === 'initialize'),
      true
    )
    assert.equal(report.cleanup.fixtureRemoved, true)
    assert.equal(JSON.stringify(report).includes('SECRET-MUST-NOT-LOG'), false)
  }
)

test(
  'unknown uppercase error codes are redacted and a failed reset preserves its owned fixture',
  { skip: process.platform !== 'win32' },
  async () => {
    const manager = {
      initialize: async () => {
        throw Object.assign(new Error('private'), { code: 'SECRET_TOKEN_VALUE' })
      },
      reset: async () => {
        throw Object.assign(new Error('private'), { code: 'ANOTHER_SECRET_VALUE' })
      }
    }
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath },
      { manager }
    )
    try {
      assert.equal(report.success, false)
      assert.equal(report.cleanup.resetCompleted, false)
      assert.equal(report.cleanup.fixtureRemoved, false)
      assert.equal(typeof report.retainedFixture, 'string')
      assert.equal(JSON.stringify(report).includes('SECRET'), false)
      assert.equal(report.failures.length, 2)
    } finally {
      if (report.retainedFixture) {
        const root = report.retainedFixture
        const ownerFile = path.join(root, '.orca-smoke-owner')
        await smoke.removeSmokeFixture({
          root,
          parent: await import('node:fs/promises').then((fs) => fs.realpath(tmpdir())),
          ownerFile,
          token: await readFile(ownerFile, 'utf8')
        })
      }
    }
  }
)

test('an already cancelled smoke never initializes SRT', async () => {
  if (process.platform !== 'win32') return
  const controller = new AbortController()
  controller.abort()
  const report = await smoke.runSandboxSmoke(
    { srtWinPath: process.execPath, launcherPath: process.execPath, signal: controller.signal },
    {
      manager: {
        initialize: async () => assert.fail('cancelled smoke initialized SRT'),
        reset: async () => assert.fail('cancelled smoke reset SRT')
      }
    }
  )
  assert.equal(report.success, false)
  assert.deepEqual(report.failures, [{ stage: 'fixture', code: 'ABORTED' }])
})

test(
  'cancelling an active ordinary runner closes it before smoke cleanup returns',
  { skip: process.platform !== 'win32' },
  async () => {
    const controller = new AbortController()
    let launchedAt
    let runnerPid
    let readiness
    let pidFile
    const manager = {
      initialize: async () => {},
      wrapWithSandboxArgv: async (marker, shell, custom, signal, cwd) => {
        assert.equal(marker, 'orca-launch-v1')
        assert.deepEqual(shell.args, [])
        assert.equal(custom, undefined)
        assert.equal(signal.aborted, false)
        pidFile = path.join(cwd, 'ordinary-runner.pid')
        launchedAt = Date.now()
        readiness = (async () => {
          const deadline = Date.now() + 5000
          while (Date.now() < deadline) {
            const value = await readFile(pidFile, 'utf8').catch(() => null)
            if (value) {
              runnerPid = Number(value)
              break
            }
            await new Promise((resolve) => setTimeout(resolve, 50))
          }
          controller.abort()
        })()
        return {
          argv: [
            process.execPath,
            '-e',
            "require('node:fs').writeFileSync(process.argv[1],String(process.pid)); process.stdin.resume(); setInterval(()=>{},1000)",
            pidFile
          ],
          env: { ...process.env }
        }
      },
      reset: async () => {
        await readiness
        assert.ok(runnerPid > 0, 'ordinary runner must publish its PID before cancellation')
        assert.throws(() => process.kill(runnerPid, 0), { code: 'ESRCH' })
      }
    }
    try {
      const report = await smoke.runSandboxSmoke(
        { srtWinPath: process.execPath, launcherPath: process.execPath, signal: controller.signal },
        { manager }
      )
      assert.equal(report.success, false)
      assert.equal(report.cleanup.runnerClosed, true)
      assert.equal(report.cleanup.resetCompleted, true)
      assert.equal(report.cleanup.fixtureRemoved, true)
      assert.deepEqual(report.failures, [{ stage: 'echo', code: 'ABORTED' }])
      assert.ok(
        Date.now() - launchedAt < 10_000,
        'cancellation should not wait for the probe timeout'
      )
      assert.ok(runnerPid > 0)
    } finally {
      await readiness
      if (runnerPid) {
        try {
          process.kill(runnerPid)
        } catch {
          /* already closed */
        }
      }
    }
  }
)

test(
  'reset timeout retains the fixture while the reset promise remains unresolved',
  { skip: process.platform !== 'win32' },
  async () => {
    const manager = {
      initialize: async () => {
        throw new Error('initialization failed')
      },
      reset: async () => new Promise(() => {})
    }
    const started = Date.now()
    const report = await smoke.runSandboxSmoke(
      { srtWinPath: process.execPath, launcherPath: process.execPath },
      { manager, resetTimeoutMs: 5 }
    )
    try {
      assert.equal(report.cleanup.resetCompleted, false)
      assert.equal(report.cleanup.fixtureRemoved, false)
      assert.equal(report.failures.at(-1).code, 'RESET_TIMEOUT')
      assert.ok(Date.now() - started < 15_000)
      assert.equal(typeof report.retainedFixture, 'string')
    } finally {
      if (report.retainedFixture) {
        const root = report.retainedFixture
        const ownerFile = path.join(root, '.orca-smoke-owner')
        await smoke.removeSmokeFixture({
          root,
          parent: await import('node:fs/promises').then((fs) => fs.realpath(tmpdir())),
          ownerFile,
          token: await readFile(ownerFile, 'utf8')
        })
      }
    }
  }
)
