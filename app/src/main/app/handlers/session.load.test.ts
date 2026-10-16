import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS, type ChatActivitySnapshot, type LoadedSession } from '../../../shared/ipc'
import type {
  NativeHistoryResult,
  NativeHistorySnapshot
} from '../../adapters/common/native-history'
import { refreshNativeHistory } from '../../features/history/native-sync'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'

const callbacks = vi.hoisted(() => new Map<string, (request: { sessionId: string }) => unknown>())
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    _schema: unknown,
    _mode: unknown,
    callback: (req: { sessionId: string }) => unknown
  ) => callbacks.set(channel, callback),
  handlePlain: vi.fn()
}))
import { registerSessionHandlers } from './session'

let db: Database.Database
let queries: DbQueries
const fallback = vi.fn((projectId?: string | null) => `/fallback/${projectId ?? 'default'}`)

beforeEach(() => {
  callbacks.clear()
  fallback.mockClear()
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  queries = new DbQueries(db)
})
afterEach(() => db.close())

async function load(
  sessionId: string,
  getActivity?: (id: string) => ChatActivitySnapshot,
  refreshHistory?: (id: string) => Promise<LoadedSession['nativeSync']>
): Promise<LoadedSession | null> {
  registerSessionHandlers(
    { db: queries, getCwd: fallback, settings: { getAll: vi.fn(), patch: vi.fn() } },
    { getActivity, refreshHistory }
  )
  const callback = callbacks.get(CHANNELS.sessionLoad)
  if (!callback) throw new Error('session load was not registered')
  return (await callback({ sessionId })) as LoadedSession | null
}

function session(id = 's1', cwd: string | null = null): number {
  queries.insertSession({
    id,
    backend: 'claude',
    title: id,
    projectId: null,
    createdAt: 1,
    providerKey: 'claude-local',
    cwd
  })
  const messageId = queries.appendMessage({
    sessionId: id,
    role: 'assistant',
    content: '',
    createdAt: 2,
    complete: 0
  })
  queries.appendPart({ messageId, type: 'text', toolRunId: null, payloadJson: '{"text":"answer"}' })
  return messageId
}

describe('session load IPC restores the complete persisted view', () => {
  it('returns null for a missing session or a session without parts and does not request activity', async () => {
    const activity = vi.fn()
    expect(await load('missing', activity)).toBeNull()
    queries.insertSession({
      id: 'empty',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1
    })
    expect(await load('empty', activity)).toBeNull()
    expect(activity).not.toHaveBeenCalled()
  })

  it('preserves ordered parts, incomplete state, usage, cost, lineage, worktree, cwd and activity', async () => {
    session('parent')
    queries.insertManagedWorktree({
      id: 'wt',
      repoRoot: '/repo',
      sourceCwd: '/repo/src',
      worktreeRoot: '/managed/wt',
      branch: 'work/test',
      baseOid: 'a'.repeat(40),
      createdAt: 1
    })
    const messageId = session('s1', '/managed/wt')
    queries.appendPart({
      messageId,
      type: 'tool_result',
      toolRunId: 'tool-1',
      payloadJson: '{"result":"done","isError":false}'
    })
    const userId = queries.appendMessage({
      sessionId: 's1',
      role: 'user',
      content: 'next',
      createdAt: 3
    })
    queries.appendPart({
      messageId: userId,
      type: 'text',
      toolRunId: null,
      payloadJson: '{"text":"next"}'
    })
    queries.insertLineage({
      childSessionId: 's1',
      parentSessionId: 'parent',
      relation: 'fork',
      forkPointMessageIdx: null,
      createdAt: 4
    })
    const usageId = queries.usage.insertTurnUsage({
      sessionId: 's1',
      messageId,
      createdAt: 5,
      inputTokens: 10,
      outputTokens: 2,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: 1.5
    })
    queries.usage.insertTurnModelUsage({
      turnUsageId: usageId,
      model: 'model-a',
      inputTokens: 10,
      outputTokens: 2,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      costUsd: 1.5,
      contextWindow: 200000
    })
    const activity: ChatActivitySnapshot = {
      type: 'chat.activity',
      sessionId: 's1',
      revision: 2,
      foreground: 'idle',
      transport: 'idle',
      queuedCount: 0,
      deliveryPendingCount: 0,
      residualCount: 0,
      backgroundTaskCount: 0
    }
    expect(await load('s1', () => activity)).toEqual({
      id: 's1',
      backend: 'claude',
      agentKind: 'code',
      title: 's1',
      providerKey: 'claude-local',
      projectId: null,
      cwd: '/managed/wt',
      extraDirs: [],
      messages: [
        {
          role: 'assistant',
          createdAt: 2,
          incomplete: true,
          parts: [
            { type: 'text', text: 'answer' },
            { type: 'tool_result', toolRunId: 'tool-1', result: 'done', isError: false }
          ]
        },
        { role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'next' }] }
      ],
      lastTelemetry: {
        model: 'model-a',
        inputTokens: 10,
        outputTokens: 2,
        costUsd: 1.5,
        modelUsage: {
          'model-a': { inputTokens: 10, outputTokens: 2, costUsd: 1.5, contextWindow: 200000 }
        }
      },
      costUsd: 1.5,
      lineage: { parentSessionId: 'parent', relation: 'fork', parentTitle: 'parent' },
      worktree: { sourceCwd: '/repo/src', repoRoot: '/repo' },
      activity
    })
    expect(fallback).not.toHaveBeenCalled()
  })

  it('uses cwd fallback and omits absent metadata without inventing payload for invalid JSON', async () => {
    const id = session()
    queries.appendPart({
      messageId: id,
      type: 'reasoning',
      toolRunId: null,
      payloadJson: 'invalid json'
    })
    expect(await load('s1')).toEqual({
      id: 's1',
      backend: 'claude',
      agentKind: 'code',
      title: 's1',
      providerKey: 'claude-local',
      projectId: null,
      cwd: '/fallback/default',
      extraDirs: [],
      messages: [
        {
          role: 'assistant',
          createdAt: 2,
          incomplete: true,
          parts: [{ type: 'text', text: 'answer' }, { type: 'reasoning' }]
        }
      ]
    })
    expect(fallback).toHaveBeenCalledWith(null)
  })

  it('omits lineage after parent deletion and returns null if metadata disappears', async () => {
    session('parent')
    session()
    queries.insertLineage({
      childSessionId: 's1',
      parentSessionId: 'parent',
      relation: 'handoff',
      forkPointMessageIdx: null,
      createdAt: 3
    })
    queries.deleteSession('parent')
    expect(await load('s1')).not.toHaveProperty('lineage')
    vi.spyOn(queries, 'getSessionById').mockReturnValue(undefined)
    expect(await load('s1')).toBeNull()
  })

  it('propagates storage errors', async () => {
    vi.spyOn(queries, 'loadParts').mockImplementation(() => {
      throw new Error('fixture read failure')
    })
    await expect(load('s1')).rejects.toThrow('fixture read failure')
  })
})

describe('session load IPC refreshes native history before composing the archived view', () => {
  function value(): NativeHistorySnapshot {
    return {
      sessionId: 's1',
      cwd: '/fixture',
      sourceKey: 'fixture-native-store',
      revision: 'revision-1',
      messages: [
        {
          id: 'native-original',
          role: 'assistant',
          createdAt: 2,
          parts: [{ type: 'text', text: 'answer' }]
        }
      ],
      raw: { mainOnly: true }
    }
  }

  function refresher(
    read: () => Promise<NativeHistoryResult>
  ): (id: string) => Promise<LoadedSession['nativeSync']> {
    return (id) => refreshNativeHistory(id, { db: queries, isBusy: () => false, read })
  }

  it('imports terminal user, assistant and tool messages and reopens twice without duplication', async () => {
    session()
    const original = queries.loadParts('s1')
    const first = value()
    const next: NativeHistorySnapshot = {
      ...first,
      revision: 'revision-2',
      messages: [
        ...first.messages,
        {
          id: 'native-user',
          role: 'user',
          createdAt: 3,
          parts: [{ type: 'text', text: 'terminal question' }]
        },
        {
          id: 'native-assistant',
          role: 'assistant',
          createdAt: 4,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'read-1',
              toolName: 'Read',
              args: { file_path: '/fixture/sample.md' }
            },
            { type: 'tool_result', toolRunId: 'read-1', result: 'sample contents', isError: false },
            { type: 'text', text: 'terminal answer' }
          ]
        }
      ]
    }
    const read = vi
      .fn<() => Promise<NativeHistoryResult>>()
      .mockResolvedValueOnce({ status: 'ready', snapshot: first })
      .mockResolvedValue({ status: 'ready', snapshot: next })
    const refresh = refresher(read)

    expect((await load('s1', undefined, refresh))?.messages).toHaveLength(1)
    const reopened = await load('s1', undefined, refresh)
    expect(reopened?.messages).toEqual(
      next.messages.map(({ role, createdAt, parts }) => ({ role, createdAt, parts }))
    )
    expect(reopened?.nativeSync).toEqual({ status: 'ready' })
    expect((await load('s1', undefined, refresh))?.messages).toEqual(reopened?.messages)
    expect(read).toHaveBeenCalledTimes(3)
    expect(queries.searchMessages('terminal')).toHaveLength(2)
    expect(queries.loadParts('s1')).toEqual(original)
    expect(reopened).not.toHaveProperty('raw')
    expect(reopened).not.toHaveProperty('sourceKey')
  })

  it.each(['missing', 'unavailable'] as const)(
    'returns the last snapshot with a %s warning instead of an empty session',
    async (status) => {
      session()
      const read = vi
        .fn<() => Promise<NativeHistoryResult>>()
        .mockResolvedValueOnce({ status: 'ready', snapshot: value() })
        .mockResolvedValue({ status, message: 'fixture native problem' })
      const refresh = refresher(read)
      const before = await load('s1', undefined, refresh)
      const after = await load('s1', undefined, refresh)

      expect(after?.messages).toEqual(before?.messages)
      expect(after?.nativeSync).toEqual({ status, message: 'fixture native problem' })
      expect(after?.messages).toHaveLength(1)
      expect(queries.nativeHistory.get('s1')).toBeDefined()
    }
  )

  it('does not reopen or query a hidden session', async () => {
    session()
    queries.hideSession('s1')
    const read = vi.fn<() => Promise<NativeHistoryResult>>()
    const activity = vi.fn()
    expect(await load('s1', activity, refresher(read))).toBeNull()
    expect(read).not.toHaveBeenCalled()
    expect(activity).not.toHaveBeenCalled()
    expect(queries.loadParts('s1')).toHaveLength(1)
  })
})
