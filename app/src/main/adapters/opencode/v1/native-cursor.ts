import { createHash } from 'node:crypto'
import type { openFileDatabase } from '../../../infra/db/file-database'

/** O(N) native projection check: event sequence alone does not cover every storage mutation. */
export function probeNativeCursor(
  openDatabase: typeof openFileDatabase,
  databasePath: string,
  sessionId: string
): { kind: 'opencode-sqlite'; sequence: number | null; digest: string } | undefined {
  const db = openDatabase(databasePath, { readonly: true, fileMustExist: true })
  try {
    return db.transaction(() => {
      // Explicit columns validate the minimum supported projection; unknown schemas use SDK reads.
      const session = db.prepare('SELECT * FROM session WHERE id = ?').get(sessionId)
      if (!session) return undefined
      const messages = db
        .prepare(
          'SELECT id, data, time_created, time_updated FROM message WHERE session_id = ? ORDER BY id'
        )
        .all(sessionId)
      const parts = db
        .prepare(
          'SELECT id, message_id, data, time_created, time_updated FROM part WHERE session_id = ? ORDER BY id'
        )
        .all(sessionId)
      const event = db
        .prepare('SELECT seq FROM event_sequence WHERE aggregate_id = ?')
        .get(sessionId) as { seq: number } | undefined
      return {
        kind: 'opencode-sqlite' as const,
        sequence: event?.seq ?? null,
        digest: createHash('sha256')
          .update(JSON.stringify({ session, messages, parts }))
          .digest('hex')
      }
    })()
  } catch {
    return undefined
  } finally {
    db.close()
  }
}
