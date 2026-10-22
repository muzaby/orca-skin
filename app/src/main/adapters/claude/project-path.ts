import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const pluginPathKey = (value: string): string => {
  const path = resolve(value.replaceAll('\\', '/'))
  return process.platform === 'win32' ? path.toLowerCase() : path
}
export function claudePluginProjectRoot(cwd: string): string {
  let current = resolve(cwd)
  for (;;) {
    try {
      statSync(join(current, '.git'))
      return current
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
    }
    const parent = dirname(current)
    if (parent === current) return resolve(cwd)
    current = parent
  }
}
export const claudeLocalSettingsRoot = (cwd: string): string =>
  process.platform === 'win32' ? resolve(cwd) : claudePluginProjectRoot(cwd)
