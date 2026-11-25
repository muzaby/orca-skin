import Database from 'better-sqlite3'
import { expect, it, vi } from 'vitest'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'
import { HistoryIndex } from './turn-index'

it('prioritizes the requested session, resumes after interrupted slices and publishes one complete revision', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys=ON')
  applyMigrations(sqlite)
  const db = new DbQueries(sqlite)
  let index = new HistoryIndex(db)
  try {
    for (const [i, id] of ['old', 'recent', 'requested'].entries()) {
      db.insertSession({ id, createdAt: i + 1, projectId: null, title: id, backend: 'claude' })
      for (let n = 0; n < 5; n++)
        db.appendMessage({
          sessionId: id,
          role: 'assistant',
          createdAt: n,
          content: '',
          complete: 1
        })
    }
    sqlite.exec(
      "UPDATE sessions SET updated_at=CASE id WHEN 'recent' THEN 3 WHEN 'old' THEN 2 ELSE 1 END"
    )
    expect(db.historyIndex.pendingSessions()).toEqual(['recent', 'old', 'requested'])
    const written = vi.spyOn(db.historyIndex, 'writeSlice')
    index.startBackground()
    const requested = await index.prepare('requested')
    expect(requested?.prepared).toBeDefined()
    expect(written.mock.calls[0][0]).toBe('requested')
    expect(db.historyIndex.latest('requested', requested!.generation)?.ordinal).toBe(4)
    index.stop()
    index = new HistoryIndex(db)
    const first = await index.prepare('recent')
    const previous = first!.generation
    sqlite.exec("UPDATE messages SET complete=0 WHERE session_id='recent'")
    const pending = index.prepare('recent')
    // A commit between the request and its scheduled slice makes an earlier revision ineligible.
    db.appendMessage({
      sessionId: 'recent',
      role: 'user',
      createdAt: 10,
      content: 'tail',
      complete: 1
    })
    const next = await pending
    expect(next?.generation).not.toBe(previous)
    expect(db.historyIndex.latest('recent', next!.generation)).toMatchObject({
      ordinal: 5,
      role: 'user'
    })
    expect((await index.prepare('recent'))?.prepared).toBeUndefined()
    expect(await index.prepare('absent')).toBeUndefined()
  } finally {
    index.stop()
    sqlite.close()
  }
})
