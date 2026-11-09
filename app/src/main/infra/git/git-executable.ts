import { access, stat, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { posix, win32 } from 'node:path'

interface ExecutableOptions {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  isFile?: (path: string) => Promise<boolean>
}

export async function resolveGitExecutable({
  env = process.env,
  platform = process.platform,
  isFile = async (path) => {
    try {
      if (!(await stat(path)).isFile()) return false
      await access(path, platform === 'win32' ? constants.F_OK : constants.X_OK)
      return true
    } catch {
      return false
    }
  }
}: ExecutableOptions = {}): Promise<string | null> {
  const windows = platform === 'win32'
  const path = windows ? win32 : posix
  const pathKey = windows ? Object.keys(env).find((key) => key.toLowerCase() === 'path') : 'PATH'
  for (const entry of (env[pathKey ?? 'PATH'] ?? '').split(windows ? ';' : ':')) {
    // win32.isAbsolute accepts drive-relative rooted paths (\foo), which still depend on cwd.
    if (!entry || !path.isAbsolute(entry) || (windows && !/^(?:[a-z]:[\\/]|[\\/]{2})/i.test(entry)))
      continue
    const candidate = path.join(entry, windows ? 'git.exe' : 'git')
    if (await isFile(candidate)) return candidate
  }
  return null
}

// 동시 첫 호출이 PATH 탐색을 한 번만 하도록 진행 중 promise 를 공유한다. 못 찾으면 비워 두어
// 세션 중 설치된 git 을 다음 호출이 다시 찾게 한다.
export interface GitCommand {
  file: string
  env: (base: NodeJS.ProcessEnv) => Promise<NodeJS.ProcessEnv>
}

interface CommandOptions extends ExecutableOptions {
  isDirectory?: (path: string) => Promise<boolean>
  readFile?: (path: string) => Promise<string>
}

/** Git for Windows 런처의 MSys2 배치만 우회한다. 캐시에 홈·PATH 사본을 담지 않는다. */
export async function resolveGitCommand(options: CommandOptions = {}): Promise<GitCommand | null> {
  const file = await resolveGitExecutable(options)
  if (!file) return null
  const unchanged = { file, env: async (base: NodeJS.ProcessEnv) => ({ ...base }) }
  if ((options.platform ?? process.platform) !== 'win32') return unchanged
  const parent = win32.dirname(file)
  if (!['cmd', 'bin'].includes(win32.basename(parent).toLowerCase())) return unchanged
  const top = win32.dirname(parent)
  const isFile =
    options.isFile ??
    (async (path: string) => {
      try {
        return (await stat(path)).isFile()
      } catch {
        return false
      }
    })
  for (const msys of ['mingw64', 'clangarm64', 'ucrt64', 'mingw32']) {
    const actual = win32.join(top, msys, 'bin', 'git.exe')
    if (!(await isFile(actual))) continue
    const isDirectory =
      options.isDirectory ??
      (async (path: string) => {
        try {
          return (await stat(path)).isDirectory()
        } catch {
          return false
        }
      })
    return {
      file: actual,
      env: async (base) => {
        const env: NodeJS.ProcessEnv = { ...base, MSYSTEM: msys.toUpperCase() }
        if (!env.PLINK_PROTOCOL) env.PLINK_PROTOCOL = 'ssh'
        if (!env.HOME) {
          const driveHome = (env.HOMEDRIVE ?? '') + (env.HOMEPATH ?? '')
          const system = win32.join(
            env.SystemRoot ?? env.SYSTEMROOT ?? env.WINDIR ?? 'C:\\Windows',
            'system32'
          )
          env.HOME =
            env.HOMEPATH &&
            driveHome &&
            (await isDirectory(driveHome)) &&
            win32.normalize(driveHome).toLowerCase() !== win32.normalize(system).toLowerCase()
              ? driveHome
              : env.USERPROFILE
        }
        const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
        const homeBin =
          env.HOME && env.HOME.length + 6 < 260 ? `${win32.join(env.HOME, 'bin')};` : ''
        env[pathKey] =
          `${win32.join(top, msys, 'bin')};${win32.join(top, 'usr', 'bin')};${homeBin}${env[pathKey] ?? ''}`
        try {
          const config = await (options.readFile ?? ((path) => readFile(path, 'utf8')))(
            win32.join(top, 'etc', 'git-bash.config')
          )
          for (const line of config.split(/\r?\n/)) {
            if (line.startsWith('MSYS='))
              env.MSYS = line.slice(5) + (env.MSYS ? ` ${env.MSYS}` : '')
          }
        } catch {
          /* 설정 파일 부재는 런처의 기본 경로다. */
        }
        return env
      }
    }
  }
  return unchanged
}

let command: Promise<GitCommand | null> | undefined
export function gitCommand(): Promise<GitCommand | null> {
  return (command ??= resolveGitCommand()
    .then((found) => {
      if (!found) command = undefined
      return found
    })
    .catch((error) => {
      command = undefined
      throw error
    }))
}
export async function gitExecutable(): Promise<string | null> {
  return (await gitCommand())?.file ?? null
}
