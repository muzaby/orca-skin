import { access, stat } from 'node:fs/promises'
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
let executable: Promise<string | null> | undefined
export function gitExecutable(): Promise<string | null> {
  return (executable ??= resolveGitExecutable().then((found) => {
    if (!found) executable = undefined
    return found
  }))
}
