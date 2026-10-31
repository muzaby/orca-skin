import { resolve } from 'node:path'
import { gitRootSync } from '../common/git-root'

export const pluginPathKey = (value: string): string => {
  const path = resolve(value.replaceAll('\\', '/'))
  return process.platform === 'win32' ? path.toLowerCase() : path
}
export const claudeLocalSettingsRoot = (cwd: string): string =>
  process.platform === 'win32' ? resolve(cwd) : claudePluginProjectRoot(cwd)

export function claudePluginProjectRoot(cwd: string): string {
  try {
    return gitRootSync(cwd)
  } catch {
    throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
  }
}
