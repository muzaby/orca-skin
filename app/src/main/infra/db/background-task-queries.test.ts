import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

describe('background event journal', () => {
  it('keeps task state and raw envelopes out of transcript and isolates sessions and generations', () => {
    const database = new Database(':memory:')
    try {
      applyMigrations(database)
      const db = new DbQueries(database)
      for (const id of ['s1', 's2'])
        db.insertSession({ id, backend: 'claude', title: null, projectId: null, createdAt: 1 })
      expect(db.background).toBeDefined()
      const source = { generation: 'g1', sequence: 1, receivedAt: 100, replay: false, uuid: 'u1' }
      const raw = {
        type: 'provider.message' as const,
        sessionId: 's1',
        source,
        raw: { token: 'private-value', type: 'unknown' }
      }
      const task = {
        type: 'background.task' as const,
        sessionId: 's1',
        source,
        taskId: 't1',
        phase: 'started' as const,
        patch: { description: 'first' }
      }
      expect(db.background.append(raw)).toBe(true)
      expect(db.background.append(task)).toBe(true)
      expect(
        db.background.append({ ...task, source: { ...source, sequence: 2, receivedAt: 200 } })
      ).toBe(false)
      expect(db.background.append({ ...task, patch: { description: 'updated' } })).toBe(true)
      expect(db.background.append({ ...task, source: { ...source, generation: 'g2' } })).toBe(true)
      expect(db.background.append({ ...task, sessionId: 's2' })).toBe(true)
      expect(db.background.list('s1')).toHaveLength(3)
      expect(db.background.list('s1', true)).toHaveLength(4)
      expect(JSON.stringify(db.background.list('s1'))).not.toContain('private-value')
      expect(db.background.list('s2')).toHaveLength(1)
      expect(db.loadParts('s1')).toEqual([])
      db.deleteSession('s1')
      expect(db.background.list('s1', true)).toEqual([])
      expect(db.background.list('s2')).toHaveLength(1)
    } finally {
      database.close()
    }
  })
})
