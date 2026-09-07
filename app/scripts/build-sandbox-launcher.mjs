import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('..', import.meta.url))
export const launcherPath = path.join(
  appDir,
  'resources',
  'sandbox',
  'win32-x64',
  'orca-sandbox-launcher.exe'
)

function execute(file, args, options = {}) {
  const result = spawnSync(file, args, { encoding: 'utf8', windowsHide: true, ...options })
  if (result.error) throw new Error(`BUILD_TOOL_FAILED: ${result.error.code}`)
  if (result.status !== 0)
    throw new Error(`BUILD_TOOL_EXIT_${result.status}\n${result.stdout}\n${result.stderr}`)
  return result.stdout
}

export function buildSandboxLauncher() {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('BUILD_REQUIRES_WINDOWS_X64')
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  )
  if (!existsSync(vswhere))
    throw new Error('MSVC_NOT_FOUND: install Visual Studio C++ build tools and Windows SDK')
  const installation = execute(vswhere, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ]).trim()
  if (!installation)
    throw new Error('MSVC_NOT_FOUND: install Visual Studio C++ build tools and Windows SDK')
  const vcvars = path.join(installation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
  // Only the trusted toolchain setup is interpreted by cmd; source/compiler argv use shell:false.
  if (/["&|<>^%!\r\n]/.test(vcvars)) throw new Error('UNSUPPORTED_TOOLCHAIN_PATH')
  const output = execute(
    process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe',
    ['/d', '/s', '/c', `call "${vcvars}" >nul && set`],
    { windowsVerbatimArguments: true }
  )
  const env = {}
  for (const line of output.split(/\r?\n/)) {
    const split = line.indexOf('=')
    if (split > 0) env[line.slice(0, split)] = line.slice(split + 1)
  }
  const directory = path.dirname(launcherPath)
  mkdirSync(directory, { recursive: true })
  const temporary = mkdtempSync(path.join(directory, '.build-'))
  if (path.dirname(temporary) !== directory) throw new Error('INVALID_BUILD_CLEANUP_PATH')
  try {
    const exe = path.join(temporary, 'orca-sandbox-launcher.exe')
    const compilerOutput = execute(
      'cl.exe',
      [
        '/nologo',
        '/W4',
        '/WX',
        '/O2',
        '/MT',
        '/EHsc',
        '/std:c++17',
        '/utf-8',
        '/DUNICODE',
        '/D_UNICODE',
        `/Fe:${exe}`,
        `/Fo:${path.join(temporary, 'main.obj')}`,
        path.join(appDir, 'native', 'sandbox-launcher', 'main.cpp'),
        '/link',
        '/INCREMENTAL:NO'
      ],
      { env }
    )
    process.stdout.write(compilerOutput)
    if (!existsSync(exe)) throw new Error('BUILD_OUTPUT_MISSING')
    renameSync(exe, launcherPath)
    process.stdout.write(`Built ${launcherPath}\n`)
  } finally {
    // The task-created directory is inside the fixed build output parent.
    rmSync(temporary, { recursive: true, force: true })
  }
  return launcherPath
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    buildSandboxLauncher()
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
