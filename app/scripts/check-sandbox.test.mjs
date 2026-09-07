import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { parseCommand, runCommand } from './check-sandbox.mjs'

test('smoke signal scope aborts without exiting and removes only its own listeners after settlement', async () => {
  const { withSmokeSignalScope } = await import('./check-sandbox.mjs')
  assert.equal(typeof withSmokeSignalScope, 'function', 'Implement smoke signal lifetime')
  for (const event of ['SIGINT', 'SIGTERM']) {
    const source = new EventEmitter()
    const existing = () => {}
    source.on(event, existing)
    let finish
    let signal
    const scope = withSmokeSignalScope((value) => {
      signal = value
      return new Promise((resolve) => {
        finish = resolve
      })
    }, source)
    assert.equal(signal.aborted, false)
    assert.equal(source.listenerCount(event), 2)
    source.emit(event)
    assert.equal(signal.aborted, true)
    assert.equal(
      source.listenerCount(event),
      2,
      'keep signal handling active while cleanup is pending'
    )
    finish('cleaned')
    assert.equal(await scope, 'cleaned')
    assert.deepEqual(source.listeners(event), [existing])
    assert.equal(source.listenerCount(event === 'SIGINT' ? 'SIGTERM' : 'SIGINT'), 0)
  }
  const source = new EventEmitter()
  await assert.rejects(
    withSmokeSignalScope(async () => {
      throw new Error('expected-failure')
    }, source),
    /expected-failure/
  )
  assert.equal(source.listenerCount('SIGINT'), 0)
  assert.equal(source.listenerCount('SIGTERM'), 0)
})

test('smoke command forwards the same cancellation signal to its cleanup owner', async () => {
  const { deps } = harness({
    user: { provisioned: true, credPresent: true },
    wfp: { state: 'installed' }
  })
  const controller = new AbortController()
  let observed
  deps.signal = controller.signal
  deps.smoke = async (options) => {
    observed = options.signal
    return { success: false }
  }
  await runCommand('smoke', deps)
  assert.equal(observed, controller.signal)
})

test('diagnostics preserve only fixed local and SRT error codes without exposing payloads', async () => {
  const { preflightErrorCode } = await import('./check-sandbox.mjs')
  assert.equal(
    typeof preflightErrorCode,
    'function',
    'Implement the safe preflight diagnostic helper'
  )
  for (const code of [
    'install_wfp_failed',
    'install_user_failed',
    'install_config_conflict',
    'install_ambient_failed',
    'install_timeout',
    'install_failed',
    'not_provisioned',
    'wfp_fence_inactive'
  ]) {
    assert.equal(
      preflightErrorCode({ code, message: 'SECRET-MUST-NOT-LOG', subcommand: 'SECRET-SUBCOMMAND' }),
      code
    )
  }
  assert.equal(preflightErrorCode(new Error('launcher_build_required')), 'launcher_build_required')
  for (const error of [
    undefined,
    null,
    'SECRET',
    { code: 'SECRET', message: 'SECRET' },
    { code: 'install_failed:SECRET' },
    { message: 'install_failed SECRET' }
  ]) {
    assert.equal(preflightErrorCode(error), 'srt_preflight_failed')
  }
})

function harness(
  status = { user: { provisioned: false, credPresent: false }, wfp: { state: 'absent' } }
) {
  const calls = []
  const deps = {
    platform: 'win32',
    version: '0.0.75',
    srtWinPath: 'C:\\test\\srt-win.exe',
    launcherPath: 'C:\\test\\orca-sandbox-launcher.exe',
    exists: () => true,
    srt: {
      resolveSrtWin: ({ path }) => ({ exe: path, prependArgs: ['--srt-win'] }),
      checkWindowsSandboxStatusAsync: async () => {
        calls.push('check')
        return status
      },
      installWindowsSandboxAsync: async () => {
        calls.push('install')
        return status
      }
    },
    smoke: async () => {
      calls.push('smoke')
      return { success: true }
    }
  }
  return { calls, deps }
}

test('CLI accepts only an explicit known command', () => {
  assert.equal(parseCommand([]), 'check')
  for (const command of ['check', 'install', 'smoke', 'diagnose'])
    assert.equal(parseCommand([command]), command)
  assert.throws(() => parseCommand(['check', '--install']), /invalid_command/)
  assert.throws(() => parseCommand(['uninstall']), /invalid_command/)
})

test('missing provisioning fails without ever installing or running a host fallback', async () => {
  for (const command of ['check', 'smoke', 'diagnose']) {
    const { deps, calls } = harness()
    const result = await runCommand(command, deps)
    assert.equal(result.exitCode, 2)
    assert.equal(result.report.code, 'srt_install_required')
    assert.deepEqual(calls, ['check'])
  }
})

test('direct diagnostic is explicit, cancellable and cannot be reported as full smoke success', async () => {
  const { deps, calls } = harness({
    user: { provisioned: true, credPresent: true },
    wfp: { state: 'installed' }
  })
  const controller = new AbortController()
  deps.signal = controller.signal
  let observed
  deps.smoke = async (options) => {
    observed = options
    return { success: true }
  }
  const result = await runCommand('diagnose', deps)
  assert.equal(observed.diagnosticDirect, true)
  assert.equal(observed.fixtureParent, path.dirname(deps.launcherPath))
  assert.equal(observed.signal, controller.signal)
  assert.equal(result.exitCode, 1)
  assert.equal(result.report.smoke.success, false)
  assert.equal(result.report.code, 'srt_diagnostic_only')
  assert.deepEqual(calls, ['check'])
})

test('cannot-read WFP is unverified, not a fabricated installed or missing result', async () => {
  const { deps, calls } = harness({
    user: { provisioned: true, credPresent: true, sid: 'private-id', caPem: 'private-cert' },
    wfp: { state: 'cannot-read' }
  })
  const checked = await runCommand('check', deps)
  assert.equal(checked.exitCode, 0)
  assert.equal(checked.report.status.wfp, 'cannot-read')
  assert.equal(checked.report.enforcement, 'unverified')
  assert.doesNotMatch(JSON.stringify(checked), /private/)
  assert.equal((await runCommand('smoke', deps)).exitCode, 0)
  assert.deepEqual(calls, ['check', 'check', 'smoke'])
})

test('explicit install cancellation fails and never claims provisioning succeeded', async () => {
  const { deps, calls } = harness()
  deps.srt.installWindowsSandboxAsync = async () => {
    calls.push('install')
    return {
      cancelled: true,
      user: { provisioned: false, credPresent: false },
      wfp: { state: 'absent' }
    }
  }
  const result = await runCommand('install', deps)
  assert.equal(result.exitCode, 2)
  assert.equal(result.report.code, 'srt_install_cancelled')
  assert.deepEqual(calls, ['check', 'install'])
})

test('already provisioned install avoids password rotation, including non-elevated WFP query', async () => {
  const { deps, calls } = harness({
    user: { provisioned: true, credPresent: true },
    wfp: { state: 'cannot-read' }
  })
  assert.equal((await runCommand('install', deps)).report.code, 'srt_already_provisioned')
  assert.deepEqual(calls, ['check'])
})

test('version, platform, binary and build prerequisites fail before restricted execution', async () => {
  const { deps, calls } = harness({
    user: { provisioned: true, credPresent: true },
    wfp: { state: 'installed' }
  })
  await assert.rejects(runCommand('check', { ...deps, version: '0.0.76' }), /srt_version_mismatch/)
  await assert.rejects(runCommand('install', { ...deps, platform: 'linux' }), /windows_required/)
  await assert.rejects(runCommand('check', { ...deps, exists: () => false }), /srt_binary_missing/)
  await assert.rejects(
    runCommand('smoke', { ...deps, exists: (file) => file !== deps.launcherPath }),
    /launcher_build_required/
  )
  assert.deepEqual(calls, ['check'])
})

test('smoke failure and cleanup evidence remain visible and nonzero', async () => {
  const { deps } = harness({
    user: { provisioned: true, credPresent: true },
    wfp: { state: 'installed' }
  })
  deps.smoke = async () => ({
    success: false,
    checks: { filesystem: false },
    cleanup: { aclRestored: false }
  })
  const result = await runCommand('smoke', deps)
  assert.equal(result.exitCode, 1)
  assert.equal(result.report.smoke.cleanup.aclRestored, false)
})
