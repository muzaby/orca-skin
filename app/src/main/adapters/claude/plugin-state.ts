import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { claudeLocalSettingsRoot } from './project-path'

/** Persist the workspace choice without changing other settings or the user's global config. */
export function persistClaudePluginState(cwd: string, key: string, enabled: boolean): void {
  const directory = join(claudeLocalSettingsRoot(cwd), '.claude')
  const file = join(directory, 'settings.local.json')
  let value: Record<string, unknown> = {}
  let mode = 0o600
  try {
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
      if (
        !isRecord(parsed) ||
        (parsed.enabledPlugins !== undefined && !isRecord(parsed.enabledPlugins))
      )
        throw new Error('invalid settings')
      value = parsed
      mode = statSync(file).mode & 0o777
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    mkdirSync(directory, { recursive: true })
    // Synchronous read/merge/rename prevents overlapping sessions from dropping sibling keys.
    const temporary = join(directory, `.settings.local.${randomUUID()}.tmp`)
    try {
      writeFileSync(
        temporary,
        JSON.stringify(
          {
            ...value,
            enabledPlugins: {
              ...(value.enabledPlugins as Record<string, unknown> | undefined),
              [key]: enabled
            }
          },
          null,
          2
        ) + '\n',
        { flag: 'wx', mode }
      )
      renameSync(temporary, file)
    } finally {
      try {
        unlinkSync(temporary)
      } catch {
        // Best effort: cleanup must not mask the write/rename result.
      }
    }
  } catch {
    throw new Error('플러그인 활성 상태를 저장할 수 없습니다. 프로젝트 설정 파일을 확인해 주세요.')
  }
}
