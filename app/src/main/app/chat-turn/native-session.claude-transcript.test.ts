import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import {
  HISTORY_SESSION_ID as sessionId,
  historyEntry,
  nativeHistoryFixture
} from '../../adapters/claude/native-history.testfixture'
import type { DbQueries } from '../../infra/db'
import { prepareNativeSession } from './native-session'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@anthropic-ai/claude-agent-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query
}))

const roots: string[] = []
afterEach(async () => {
  vi.clearAllMocks()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

// No recovery row and no previous snapshot: the first send after an app restart.
const db = {
  nativeHistory: { recovery: () => undefined, get: () => undefined }
} as unknown as DbQueries

type Shape = 'subfolder' | 'deleted-subfolder' | 'relocated-elsewhere' | 'relocated-missing'

async function prepare(shape: Shape): Promise<{
  adapter: ClaudeAdapter
  recover: ReturnType<typeof vi.spyOn>
  result: Awaited<ReturnType<typeof prepareNativeSession>>
  cwd: string
  env: Record<string, string>
}> {
  const f = await nativeHistoryFixture()
  roots.push(f.root)
  const sub = path.join(f.cwd, 'sub')
  const other = path.join(f.root, 'other')
  await mkdir(other)
  if (shape === 'subfolder') await mkdir(sub)
  const user = historyEntry('user-1', null, 'user', 'hello')
  const answer = historyEntry('assistant-1', 'user-1', 'assistant', [{ type: 'text', text: 'ok' }])
  const stamp = (relocatedCwd: string): Record<string, unknown> => ({
    type: 'relocated',
    sessionId,
    relocatedCwd
  })
  await f.write(
    {
      subfolder: [user, { ...answer, cwd: sub }],
      'deleted-subfolder': [user, { ...answer, cwd: sub }],
      'relocated-elsewhere': [user, stamp(other), answer],
      'relocated-missing': [user, stamp(path.join(f.root, 'gone')), answer]
    }[shape]
  )
  const adapter = new ClaudeAdapter()
  const recover = vi.spyOn(adapter, 'recoverSession')
  const env = { CLAUDE_CONFIG_DIR: f.config }
  const result = await prepareNativeSession(
    adapter,
    { sessionId, cwd: f.cwd, env },
    db,
    () => f.cwd
  )
  return { adapter, recover, result, cwd: f.cwd, env }
}

describe('Claude session continuation after a restart (no live channel)', () => {
  it.each(['subfolder', 'deleted-subfolder'] as const)(
    'resumes the same native session when the transcript moved into a %s',
    async (shape) => {
      const { adapter, recover, result, cwd, env } = await prepare(shape)
      expect(result).toEqual({ ok: true, value: { nativeSessionId: sessionId } })
      expect(recover).not.toHaveBeenCalled()
      if (!result.ok) throw new Error('expected a prepared native session')
      query.mockReturnValue({ close: vi.fn(), setPermissionMode: vi.fn(), interrupt: vi.fn() })
      const live = adapter.sendMessage({
        sessionId: result.value.nativeSessionId!,
        cwd,
        text: 'next input',
        env,
        extensions: { skills: [], hooks: { normalized: {} } }
      })
      try {
        expect(query.mock.calls[0]?.[0].options).toMatchObject({ resume: sessionId, cwd })
      } finally {
        live.close()
      }
    }
  )

  it.each(['relocated-elsewhere', 'relocated-missing'] as const)(
    'keeps a %s session unavailable without creating a new native session',
    async (shape) => {
      const { recover, result } = await prepare(shape)
      expect(result).toMatchObject({
        ok: false,
        error: {
          category: 'schema_validation_error',
          message: 'Claude 원본 세션의 작업 경로가 저장된 세션과 일치하지 않습니다.'
        }
      })
      expect(recover).not.toHaveBeenCalled()
      expect(query).not.toHaveBeenCalled()
    }
  )
})
