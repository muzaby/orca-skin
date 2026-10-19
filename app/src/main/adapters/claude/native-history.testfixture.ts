import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ClaudeHistoryEntry } from './native-history-map'

export const HISTORY_SESSION_ID = '11111111-1111-4111-8111-111111111111'

export function historyEntry(
  uuid: string,
  parentUuid: string | null,
  type: 'user' | 'assistant',
  content: unknown,
  extra: Record<string, unknown> = {}
): ClaudeHistoryEntry {
  return {
    uuid,
    parentUuid,
    type,
    sessionId: HISTORY_SESSION_ID,
    timestamp: '2026-10-16T00:00:00.000Z',
    message: { role: type, content, ...(type === 'assistant' ? { stop_reason: 'end_turn' } : {}) },
    ...extra
  }
}

export async function nativeHistoryFixture(): Promise<{
  root: string
  cwd: string
  config: string
  file: string
  write: (entries: ClaudeHistoryEntry[]) => Promise<void>
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-native-history-'))
  const cwd = path.join(root, 'workspace')
  const config = path.join(root, 'native-config')
  const project = path.join(config, 'projects', 'native-project-key')
  await mkdir(cwd)
  await mkdir(project, { recursive: true })
  const file = path.join(project, `${HISTORY_SESSION_ID}.jsonl`)
  const write = async (entries: ClaudeHistoryEntry[]): Promise<void> => {
    await writeFile(
      file,
      entries.map((entry) => JSON.stringify({ cwd, ...entry })).join('\n') + '\n'
    )
  }
  await write([
    historyEntry('user-1', null, 'user', 'hello'),
    historyEntry('assistant-1', 'user-1', 'assistant', [{ type: 'text', text: 'native answer' }])
  ])
  return { root, cwd, config, file, write }
}
