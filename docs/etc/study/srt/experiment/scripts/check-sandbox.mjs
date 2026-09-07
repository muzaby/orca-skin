// Explicit developer preflight. Importing this module never installs or initializes SRT.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const expectedVersion = '0.0.75'
const scriptPath = fileURLToPath(import.meta.url)

const localErrorCodes = new Set([
  'invalid_command',
  'windows_required',
  'srt_version_mismatch',
  'srt_binary_missing',
  'launcher_build_required'
])
// WindowsSandboxErrorCode from the pinned 0.0.75 public declaration. Never emit
// arbitrary error.message/subcommand: they can include credential-bearing URLs.
const windowsErrorCodes = new Set([
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
  'trust_ca_failed',
  'trust_ca_not_installed',
  'trust_ca_thumbprint_mismatch',
  'install_wfp_failed',
  'install_user_failed',
  'install_config_conflict',
  'install_ambient_failed',
  'install_timeout',
  'install_failed',
  'uninstall_failed',
  'acl_stamp_failed',
  'acl_grant_failed',
  'argv_too_long',
  'not_provisioned',
  'mapped_drive_cwd'
])

export function preflightErrorCode(error) {
  if (windowsErrorCodes.has(error?.code)) return error.code
  if (localErrorCodes.has(error?.message)) return error.message
  return 'srt_preflight_failed'
}

// Smoke owns live children and policy state. Keep the process alive on cancellation
// until its cleanup promise settles, then remove exactly the listeners we installed.
export async function withSmokeSignalScope(operation, source = process) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  source.on('SIGINT', abort)
  source.on('SIGTERM', abort)
  try {
    return await operation(controller.signal)
  } finally {
    source.removeListener('SIGINT', abort)
    source.removeListener('SIGTERM', abort)
  }
}

export function parseCommand(args) {
  const command = args[0] ?? 'check'
  if (args.length > 1 || !['check', 'install', 'smoke', 'diagnose'].includes(command)) {
    throw new Error('invalid_command')
  }
  return command
}

function summary(status) {
  return {
    userProvisioned: status.user.provisioned === true,
    credentialPresent: status.user.credPresent === true,
    wfp: status.wfp.state
  }
}

function provisioned(status) {
  return (
    status.userProvisioned &&
    status.credentialPresent &&
    ['installed', 'cannot-read'].includes(status.wfp)
  )
}

export async function runCommand(command, deps) {
  parseCommand([command])
  if (deps.platform !== 'win32') throw new Error('windows_required')
  if (deps.version !== expectedVersion) throw new Error('srt_version_mismatch')
  if (!deps.exists(deps.srtWinPath)) throw new Error('srt_binary_missing')
  const srtWin = deps.srt.resolveSrtWin({ path: deps.srtWinPath })
  let status = summary(await deps.srt.checkWindowsSandboxStatusAsync({ srtWin }))
  const report = { command, version: expectedVersion, status, enforcement: 'unverified' }

  if (command === 'install') {
    // Re-running SRT install rotates the shared account password. Do not use it as a check.
    if (provisioned(status)) {
      return {
        exitCode: 0,
        report: { ...report, code: 'srt_already_provisioned', next: 'npm run sandbox:smoke' }
      }
    }
    const installed = await deps.srt.installWindowsSandboxAsync({ srtWin })
    status = summary(installed)
    if (installed.cancelled) {
      return { exitCode: 2, report: { ...report, status, code: 'srt_install_cancelled' } }
    }
    return {
      exitCode: provisioned(status) ? 0 : 2,
      report: {
        ...report,
        status,
        code: provisioned(status) ? 'srt_provisioned' : 'srt_install_incomplete',
        next: 'npm run sandbox:smoke'
      }
    }
  }

  if (!provisioned(status)) {
    return {
      exitCode: 2,
      report: { ...report, code: 'srt_install_required', next: 'npm run sandbox:install' }
    }
  }
  if (command === 'check') {
    // An unelevated WFP query can be unreadable. Only initialize's live fence probe verifies it.
    return {
      exitCode: 0,
      report: { ...report, code: 'srt_provisioned', next: 'npm run sandbox:smoke' }
    }
  }
  if (!deps.exists(deps.launcherPath)) throw new Error('launcher_build_required')
  const smoke = await deps.smoke({
    srtWinPath: deps.srtWinPath,
    launcherPath: deps.launcherPath,
    signal: deps.signal,
    // Developer fixtures sit beside the built asset; Node module resolution otherwise lstat()s
    // the real user's protected profile above %TEMP%. Never widen that profile's read policy.
    fixtureParent: path.dirname(deps.launcherPath),
    ...(command === 'diagnose' ? { diagnosticDirect: true } : {})
  })
  if (command === 'diagnose') {
    return {
      exitCode: 1,
      report: { ...report, code: 'srt_diagnostic_only', smoke: { ...smoke, success: false } }
    }
  }
  return { exitCode: smoke.success ? 0 : 1, report: { ...report, smoke } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const command = parseCommand(process.argv.slice(2))
    const require = createRequire(import.meta.url)
    const entry = require.resolve('@anthropic-ai/sandbox-runtime')
    const version = JSON.parse(
      readFileSync(path.resolve(path.dirname(entry), '../package.json'), 'utf8')
    ).version
    const srt = await import('@anthropic-ai/sandbox-runtime')
    const launcherPath = path.resolve(
      path.dirname(scriptPath),
      `../resources/sandbox/win32-${process.arch}/orca-sandbox-launcher.exe`
    )
    const deps = {
      platform: process.platform,
      version,
      srt,
      srtWinPath: srt.VENDORED_SRT_WIN_EXE,
      launcherPath,
      exists: existsSync,
      smoke: async (options) => (await import('./sandbox-smoke.mjs')).runSandboxSmoke(options)
    }
    const result =
      command === 'smoke' || command === 'diagnose'
        ? await withSmokeSignalScope((signal) => runCommand(command, { ...deps, signal }))
        : await runCommand(command, deps)
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`)
    process.exitCode = result.exitCode
  } catch (error) {
    const code = preflightErrorCode(error)
    process.stderr.write(`${JSON.stringify({ code })}\n`)
    process.exitCode = 1
  }
}
