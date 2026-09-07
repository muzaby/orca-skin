import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { loadSession } from './reader'

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
})
