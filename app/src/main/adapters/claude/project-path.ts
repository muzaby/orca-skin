import { resolve } from 'node:path'
import { gitRootLineage, gitRootSync } from '../common/git-root'

export const pluginPathKey = (value: string): string => {
  const path = resolve(value.replaceAll('\\', '/'))
  return process.platform === 'win32' ? path.toLowerCase() : path
}
function localSettingsRoot<T>(cwd: string, projectRoot: () => T): string | T {
  return process.platform === 'win32' ? resolve(cwd) : projectRoot()
}

export const claudeLocalSettingsRoot = (cwd: string): string =>
  localSettingsRoot(cwd, () => claudePluginProjectRoot(cwd))

export async function claudeLocalSettingsRootAsync(cwd: string): Promise<string> {
  try {
    return await localSettingsRoot(cwd, async () => (await gitRootLineage(cwd)).root)
  } catch {
    throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
  }
}

export function claudePluginProjectRoot(cwd: string): string {
  try {
    return gitRootSync(cwd)
  } catch {
    throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
  }
}
