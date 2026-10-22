import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isRecord } from '../../../../shared/obj'
import { parseConfig } from './configured-resources'
import type { ProjectResourcePolicy } from '../../common/project-resources'

export const openCodeProjectFiles = (cwd: string): string[] =>
  [cwd, join(cwd, '.opencode')].flatMap((root) =>
    ['opencode.json', 'opencode.jsonc'].map((name) => join(root, name))
  )

/** Observe native project declarations. Writing them would also affect future child directories. */
export async function readOpenCodeProjectSettings(cwd: string): Promise<{
  revision: string
  mcp: Record<string, boolean>
}> {
  const declarations: unknown[] = []
  const mcp: Record<string, boolean> = {}
  for (const file of openCodeProjectFiles(cwd)) {
    try {
      const config = parseConfig(await readFile(file, 'utf8'))
      if (!isRecord(config)) throw new Error('invalid config')
      declarations.push({ mcp: config.mcp, plugin: config.plugin })
      for (const [id, value] of Object.entries(isRecord(config.mcp) ? config.mcp : {}))
        if (isRecord(value)) mcp[id] = value.enabled !== false
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw new Error('OpenCode 프로젝트 확장 설정을 읽을 수 없습니다.')
    }
  }
  return { revision: createHash('sha256').update(JSON.stringify(declarations)).digest('hex'), mcp }
}

export const openCodeProjectResources: ProjectResourcePolicy = {
  files: openCodeProjectFiles,
  read: readOpenCodeProjectSettings
}
