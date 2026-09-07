import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import http from 'node:http'

const smoke = await import('./sandbox-smoke.mjs')
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
