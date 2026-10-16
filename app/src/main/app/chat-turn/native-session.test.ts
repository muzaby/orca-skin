import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { loadSession } from '../../features/history/reader'
import { refreshNativeHistory } from '../../features/history/native-sync'
import { restoreRecoveryResult } from '../../features/history/native-recovery'
import type { NativeHistoryResult } from '../../adapters/common/native-history'
import { prepareNativeSession } from './native-session'
import { HistoryWriter } from '../../features/history/writer'
import type { TurnContext } from '../../contracts/turn'
import { resolveTurn } from './resolve-turn'
import type { RouterContext } from '../context'

vi.mock('../../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))
vi.mock('../../infra/config/orca-config', () => ({ appEnv: () => ({ APP_ENV: 'app' }) }))

let db: Database.Database
let queries: DbQueries
const request = { sessionId: 'orca-session', cwd: 'C:/work' }
const missing = { status: 'missing', message: 'Expired' } as const
const cwd = (): string => 'C:/work'
function append(text: string, role: 'user' | 'assistant' = 'user'): void {
  const id = queries.appendMessage({
    sessionId: request.sessionId,
    role,
    content: text,
    createdAt: Date.now()
  })
  queries.appendPart({
    messageId: id,
    type: 'text',
    toolRunId: null,
    payloadJson: JSON.stringify({ text })
  })
}
function texts(): string[] {
  return loadSession(queries, request.sessionId, cwd)!.messages.flatMap((message) =>
    message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : []))
  )
}
function native(messages: Array<{ id: string; text: string }>): NativeHistoryResult {
  return {
    status: 'ready',
    snapshot: {
      sessionId: 'native-new',
      cwd: cwd(),
      sourceKey: 'native-file',
      revision: 'revision',
      messages: messages.map(({ id, text }) => ({
        id,
        role: 'user',
        createdAt: 1,
        parts: [{ type: 'text', text }]
      }))
    }
  }
}
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  queries = new DbQueries(db)
  queries.insertSession({
    id: request.sessionId,
    backend: 'opencode',
    title: 'Archive',
    projectId: null,
    cwd: cwd(),
    createdAt: 1
  })
  append('archivedquestion')
  append('archivedanswer', 'assistant')
})
afterEach(() => db.close())

describe('native retention recovery through the migrated archive', () => {
  it('carries cold-resume recovery through provider resolution while keeping the visible input unchanged', async () => {
    const adapter = {
      id: 'opencode' as const,
      agentSpawnEnv: () => ({}),
      readHistory: vi.fn(async () => missing),
      recoverSession: vi.fn(async () => ({ sessionId: 'native-new', freshStart: false }))
    }
    const ctx = {
      db: queries,
      getCwd: cwd,
      harnessSettings: { list: () => [] },
      mcp: { resolver: () => () => undefined }
    } as unknown as RouterContext
    const result = await resolveTurn(
      ctx,
      { hasSession: () => false, peekRuntime: () => undefined } as never,
      adapter,
      {
        sessionId: request.sessionId,
        text: 'visible input',
        agentKind: 'code',
        projectId: null
      } as never
    )
    expect(result).toMatchObject({
      ok: true,
      value: {
        effectiveText: 'visible input',
        native: {
          nativeSessionId: 'native-new',
          recoveryFreshStart: false,
          recoveryHistory: expect.stringContaining('archivedanswer')
        }
      }
    })
    expect(adapter.readHistory).toHaveBeenCalledWith(expect.objectContaining(request))
    expect(adapter.recoverSession).toHaveBeenCalledOnce()
  })
  it('persists a replacement across restart and settles its receipt through the real history writer', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-recovery-'))
    const file = join(root, 'recovery.db')
    // The fixture is replaced with a file database; no user history is used.
    db.close()
    db = new Database(file)
    applyMigrations(db)
    queries = new DbQueries(db)
    queries.insertSession({
      id: request.sessionId,
      backend: 'opencode',
      title: 'Archive',
      projectId: null,
      cwd: cwd(),
      createdAt: 1
    })
    append('archivedquestion')
    const adapter = {
      readHistory: vi.fn(async (): Promise<NativeHistoryResult> => missing),
      recoverSession: vi.fn(async () => ({ sessionId: 'native-new', freshStart: false }))
    }
    try {
      await prepareNativeSession(adapter, request, queries, cwd)
      queries.nativeHistory.recoveryPrompt(request.sessionId, 'receipt', 'only new input')
      db.close()
      db = new Database(file)
      queries = new DbQueries(db)
      expect(queries.nativeHistory.recovery(request.sessionId)).toMatchObject({
        native_id: 'native-new',
        prompt_id: 'receipt',
        accepted: 0
      })
      expect(texts()).toEqual(['archivedquestion'])
      const turn = {
        dbSessionId: request.sessionId,
        currentAssistantMessageId: null,
        pendingAskAnswers: [],
        askPendingIds: [],
        askResolved: new Map(),
        providerKey: null
      } as unknown as TurnContext
      new HistoryWriter(queries, () => false).commitUserMessage(turn, {
        text: 'only new input',
        nativeMessageId: 'receipt',
        createdAt: 2
      })
      expect(queries.nativeHistory.recovery(request.sessionId)?.accepted).toBe(1)
      expect(texts()).toEqual(['archivedquestion', 'only new input'])
      adapter.readHistory.mockResolvedValue(native([]))
      expect(await prepareNativeSession(adapter, request, queries, cwd)).toEqual({
        ok: true,
        value: { nativeSessionId: 'native-new' }
      })
      expect(adapter.readHistory).toHaveBeenLastCalledWith(
        expect.objectContaining({ sessionId: 'native-new' })
      )
      expect(adapter.recoverSession).toHaveBeenCalledOnce()
    } finally {
      db.close()
      db = new Database(':memory:') // afterEach retains a single owner for the open fixture.
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('replaces only a confirmed missing native identity and retains the transcript and search once', async () => {
    const recoverSession = vi.fn(async () => ({ sessionId: 'native-new', freshStart: false }))
    const result = await prepareNativeSession(
      { readHistory: async () => missing, recoverSession },
      request,
      queries,
      cwd
    )
    expect(result).toEqual({
      ok: true,
      value: {
        nativeSessionId: 'native-new',
        recoveryFreshStart: false,
        recoveryHistory: expect.stringContaining('archivedanswer')
      }
    })
    expect(texts()).toEqual(['archivedquestion', 'archivedanswer'])
    expect(queries.getSessionById(request.sessionId)?.backend).toBe('opencode')
    expect(queries.nativeHistory.recovery(request.sessionId)?.native_id).toBe('native-new')
    expect(queries.nativeHistory.get(request.sessionId)).toBeUndefined()
    expect(queries.searchMessages('archivedanswer')).toHaveLength(1)
    const readHistory = vi.fn(async () => native([]))
    expect(
      await prepareNativeSession({ readHistory, recoverSession }, request, queries, cwd)
    ).toMatchObject({
      ok: true,
      value: {
        nativeSessionId: 'native-new',
        recoveryHistory: expect.stringContaining('archivedquestion')
      }
    })
    expect(readHistory).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'native-new' }))
    expect(recoverSession).toHaveBeenCalledTimes(1)
  })

  it('keeps the recovery prefix out of native reload and does not refeed it after acceptance', async () => {
    const adapter = {
      readHistory: vi.fn(async (): Promise<NativeHistoryResult> => missing),
      recoverSession: vi.fn(async () => ({ sessionId: 'native-new', freshStart: false }))
    }
    await prepareNativeSession(adapter, request, queries, cwd)
    queries.nativeHistory.recoveryPrompt(request.sessionId, 'first-prompt', 'new request')
    const restored = restoreRecoveryResult(
      native([{ id: 'first-prompt', text: 'ARCHIVE PREFIX + new request' }]),
      request.sessionId,
      queries.nativeHistory.recovery(request.sessionId)
    )
    expect(
      await refreshNativeHistory(request.sessionId, {
        db: queries,
        isBusy: () => false,
        read: async () => restored
      })
    ).toEqual({ status: 'ready' })
    expect(texts()).toEqual(['archivedquestion', 'archivedanswer', 'new request'])
    adapter.readHistory.mockResolvedValue(
      native([{ id: 'first-prompt', text: 'ARCHIVE PREFIX + new request' }])
    )
    expect(await prepareNativeSession(adapter, request, queries, cwd)).toEqual({
      ok: true,
      value: { nativeSessionId: 'native-new' }
    })
    expect(queries.nativeHistory.recovery(request.sessionId)?.accepted).toBe(1)
    // A second expiry archives both generations, with no duplicated first-generation rows.
    adapter.readHistory.mockResolvedValue(missing)
    adapter.recoverSession.mockResolvedValue({ sessionId: 'native-newer', freshStart: false })
    const again = await prepareNativeSession(adapter, request, queries, cwd)
    expect(again).toMatchObject({
      ok: true,
      value: {
        nativeSessionId: 'native-newer',
        recoveryHistory: expect.stringContaining('new request')
      }
    })
    expect(texts()).toEqual(['archivedquestion', 'archivedanswer', 'new request'])
    expect(queries.nativeHistory.get(request.sessionId)).toBeUndefined()
    expect(db.pragma('foreign_key_check')).toEqual([])
  })

  it.each(['unavailable', 'migration-required'] as const)(
    'does not create a session for %s',
    async (status) => {
      const recoverSession = vi.fn()
      const result = await prepareNativeSession(
        { readHistory: async () => ({ status, message: 'Unavailable' }), recoverSession },
        request,
        queries,
        cwd
      )
      expect(result.ok).toBe(false)
      expect(recoverSession).not.toHaveBeenCalled()
      expect(texts()).toEqual(['archivedquestion', 'archivedanswer'])
    }
  )

  it('retains the archive when native creation fails or a concurrent write invalidates preparation', async () => {
    const adapter = {
      readHistory: async () => missing,
      recoverSession: vi.fn(async () => {
        throw new Error('offline')
      })
    }
    expect((await prepareNativeSession(adapter, request, queries, cwd)).ok).toBe(false)
    expect(queries.nativeHistory.recovery(request.sessionId)).toBeUndefined()
    const result = await prepareNativeSession(
      {
        readHistory: async () => missing,
        recoverSession: async () => {
          append('concurrent message')
          return { sessionId: 'unused-native', freshStart: false }
        }
      },
      request,
      queries,
      cwd
    )
    expect(result.ok).toBe(false)
    expect(queries.nativeHistory.recovery(request.sessionId)).toBeUndefined()
    expect(texts()).toEqual(['archivedquestion', 'archivedanswer', 'concurrent message'])
  })
})
