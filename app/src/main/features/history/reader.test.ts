import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { loadSession } from './reader'
import { recoveryArchive } from './native-recovery'

let connection: Database.Database
let db: DbQueries
beforeEach(() => {
  connection = new Database(':memory:')
  connection.pragma('foreign_keys = ON')
  applyMigrations(connection)
  db = new DbQueries(connection)
})
afterEach(() => connection.close())

describe('history reader with the current SQLite schema', () => {
  it('usage facade shares the session transaction and rollback', () => {
    const failure = new Error('rollback')
    expect(() =>
      connection.transaction(() => {
        db.insertSession({
          id: 's1',
          backend: 'claude',
          title: null,
          projectId: null,
          createdAt: 1
        })
        db.usage.insertTurnUsage({
          sessionId: 's1',
          messageId: null,
          createdAt: 2,
          inputTokens: 10,
          outputTokens: null,
          cacheCreationInputTokens: null,
          cacheReadInputTokens: null,
          totalCostUsd: 1
        })
        expect(db.usage.sumSessionCostUsd('s1')).toBe(1)
        throw failure
      })()
    ).toThrow(failure)
    expect(db.getSessionById('s1')).toBeUndefined()
    expect(db.usage.getLatestTurnUsage('s1')).toBeUndefined()
  })

  it('loads ordered persisted parts and leaves activity to the IPC owner', () => {
    db.insertSession({
      id: 's1',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1,
      cwd: '/persisted'
    })
    const messageId = db.appendMessage({
      sessionId: 's1',
      role: 'assistant',
      content: '',
      createdAt: 2,
      complete: 0
    })
    db.appendPart({ messageId, type: 'text', toolRunId: null, payloadJson: '{"text":"first"}' })
    db.appendPart({ messageId, type: 'reasoning', toolRunId: null, payloadJson: 'invalid' })
    const getCwd = vi.fn(() => '/fallback')
    const result = loadSession(db, 's1', getCwd)
    expect(result).toMatchObject({
      cwd: '/persisted',
      messages: [
        {
          role: 'assistant',
          createdAt: 2,
          incomplete: true,
          parts: [{ type: 'text', text: 'first' }, { type: 'reasoning' }]
        }
      ]
    })
    expect(result).not.toHaveProperty('activity')
    expect(result).not.toHaveProperty('lastTelemetry')
    expect(result).not.toHaveProperty('costUsd')
    expect(getCwd).not.toHaveBeenCalled()
    expect(loadSession(db, 'missing', getCwd)).toBeNull()
  })

  it('rejects a corrupt persisted kind instead of returning an invalid current session', () => {
    connection.pragma('ignore_check_constraints = ON')
    connection
      .prepare(
        "INSERT INTO sessions (id, backend, created_at, updated_at, agent_kind) VALUES ('bad', 'claude', 1, 1, 'corrupt')"
      )
      .run()
    connection.pragma('ignore_check_constraints = OFF')
    const messageId = db.appendMessage({
      sessionId: 'bad',
      role: 'user',
      content: 'kept',
      createdAt: 2
    })
    db.appendPart({
      messageId,
      type: 'text',
      toolRunId: null,
      payloadJson: '{"text":"kept"}'
    })

    expect(() => loadSession(db, 'bad', () => '/fallback')).toThrow('Invalid agent kind')
  })

  it('VP-05 i1, i2, i6: loads message_key when present, falls back to m:<id>, and assigns x:<idx> for archived messages without id', () => {
    db.insertSession({
      id: 's-id',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1,
      cwd: '/w'
    })
    const m1 = db.appendMessage({
      sessionId: 's-id',
      role: 'user',
      content: 'hi',
      createdAt: 2,
      messageKey: 'u:req-1'
    })
    db.appendPart({ messageId: m1, type: 'text', toolRunId: null, payloadJson: '{"text":"hi"}' })
    const m2 = db.appendMessage({
      sessionId: 's-id',
      role: 'assistant',
      content: 'hello',
      createdAt: 3
    })
    db.appendPart({ messageId: m2, type: 'text', toolRunId: null, payloadJson: '{"text":"hello"}' })

    const loaded = loadSession(db, 's-id', () => '/w')!
    expect(loaded.messages.map((m) => m.id)).toEqual(['u:req-1', `m:${m2}`])
    expect(new Set(loaded.messages.map((m) => m.id)).size).toBe(2)

    expect(recoveryArchive()).toEqual([])
    const user = {
      id: 'u:kept',
      role: 'user',
      createdAt: 1,
      parts: [{ type: 'text', text: 'old' }]
    }
    const assistant = {
      role: 'assistant',
      createdAt: 2,
      incomplete: true,
      parts: [{ type: 'reasoning', text: 'no-id' }]
    }
    const archived = recoveryArchive({
      native_id: 'archive',
      local_frontier: 2,
      fresh_start: 0,
      prompt_id: null,
      prompt_text: null,
      accepted: 1,
      archive_json: JSON.stringify([user, assistant])
    })
    expect(archived).toEqual([user, { ...assistant, id: 'x:1' }])
  })
})
