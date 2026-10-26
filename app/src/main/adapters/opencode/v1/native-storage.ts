import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Matches OpenCode 1.x/xdg-basedir; never replaces the user's storage environment. */
export function nativeOpenCodeEnvironment(
  config: Record<string, unknown>,
  env?: Record<string, string>,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return {
    ...base,
    ...env,
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...config, share: 'disabled', snapshot: false })
  }
}

export function nativeOpenCodeData(env: NodeJS.ProcessEnv, cwd?: string): string {
  const home = process.platform === 'win32' ? env.USERPROFILE || homedir() : env.HOME || homedir()
  const root = env.XDG_DATA_HOME || join(home, '.local', 'share')
  return resolve(nativeWorkingDirectory(cwd), root, 'opencode')
}

export function nativeWorkingDirectory(cwd?: string): string {
  return resolve(cwd || homedir())
}

export function sameNativePath(a: string, b: string): boolean {
  const canonical = (path: string): string => {
    const value = resolve(path)
    return process.platform === 'win32' ? value.toLowerCase() : value
  }
  return canonical(a) === canonical(b)
}
