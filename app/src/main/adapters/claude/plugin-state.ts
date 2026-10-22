import { join } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { nativeFileMutations, type FileMutationCoordinator } from '../../infra/config/file-mutation'
import { claudeLocalSettingsRoot } from './project-path'

/** Patch only the requested plugin key after earlier writers have committed. */
export async function persistClaudePluginState(
  cwd: string,
  key: string,
  enabled: boolean,
  mutations: FileMutationCoordinator = nativeFileMutations
): Promise<void> {
  const file = join(claudeLocalSettingsRoot(cwd), '.claude', 'settings.local.json')
  try {
    await mutations.mutate(
      file,
      (latest) => {
        const value: unknown = latest === undefined ? {} : JSON.parse(latest.replace(/^\uFEFF/, ''))
        if (
          !isRecord(value) ||
          (value.enabledPlugins !== undefined && !isRecord(value.enabledPlugins))
        )
          throw new Error('invalid settings')
        return (
          JSON.stringify(
            { ...value, enabledPlugins: { ...(value.enabledPlugins as object), [key]: enabled } },
            null,
            2
          ) + '\n'
        )
      },
      { root: cwd }
    )
  } catch {
    throw new Error('플러그인 활성 상태를 저장할 수 없습니다. 프로젝트 설정 파일을 확인해 주세요.')
  }
}
