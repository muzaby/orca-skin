import type Database from 'better-sqlite3'
import type { SearchHitRow } from './types'

export interface NativeSnapshotRow {
  payload_json: string
  local_frontier: number
  synced_at: number
}

export interface NativeMessageBinding {
  message_id: number
  native_message_id: string
}

interface SearchableNativeMessage {
  id: string
  role: 'user' | 'assistant'
  createdAt: number
  content: string
}

/** Native formats stay outside infra. Snapshot and search rows commit together. */
export class NativeHistoryQueries {
  constructor(private readonly db: Database.Database) {}

  observe(sessionId: string): { version: number; frontier: number } {
    return this.db
      .prepare(
        `SELECT total_changes() AS version,
      COALESCE((SELECT MAX(id) FROM messages WHERE session_id = ?), 0) AS frontier`
      )
      .get(sessionId) as { version: number; frontier: number }
  }

  get(sessionId: string): NativeSnapshotRow | undefined {
    return this.db
      .prepare(
        'SELECT payload_json, local_frontier, synced_at FROM native_history_snapshots WHERE session_id = ?'
      )
      .get(sessionId) as NativeSnapshotRow | undefined
  }

  bind(messageId: number, nativeMessageId: string): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO native_message_bindings (message_id, native_message_id) VALUES (?, ?)'
      )
      .run(messageId, nativeMessageId)
  }

  bindings(sessionId: string): NativeMessageBinding[] {
    return this.db
      .prepare(
        `SELECT b.message_id, b.native_message_id
      FROM native_message_bindings b JOIN messages m ON m.id = b.message_id
      WHERE m.session_id = ? ORDER BY m.idx`
      )
      .all(sessionId) as NativeMessageBinding[]
  }

  replace(input: {
    sessionId: string
    payloadJson: string
    frontier: number
    expectedVersion: number
    messages: SearchableNativeMessage[]
    now: number
  }): boolean {
    return this.db.transaction(() => {
      if (this.observe(input.sessionId).version !== input.expectedVersion) return false
      if (
        !this.db
          .prepare('SELECT 1 FROM sessions WHERE id = ? AND hidden_at IS NULL')
          .get(input.sessionId)
      )
        return false
      this.db
        .prepare(
          `INSERT INTO native_history_snapshots (session_id, payload_json, local_frontier, synced_at)
        VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET
        payload_json=excluded.payload_json, local_frontier=excluded.local_frontier, synced_at=excluded.synced_at`
        )
        .run(input.sessionId, input.payloadJson, input.frontier, input.now)
      this.db
        .prepare('DELETE FROM native_history_messages WHERE session_id = ?')
        .run(input.sessionId)
      const insert = this.db.prepare(`INSERT INTO native_history_messages
        (session_id, native_id, role, created_at, content) VALUES (?, ?, ?, ?, ?)`)
      for (const message of input.messages) {
        insert.run(input.sessionId, message.id, message.role, message.createdAt, message.content)
      }
      return true
    })()
  }

  search(query: string, limit: number): SearchHitRow[] {
    return this.db
      .prepare(
        `SELECT -m.id AS message_id, m.session_id, m.role, m.created_at,
        s.title AS session_title,
        snippet(native_history_fts, 0, '<mark>', '</mark>', '…', 24) AS snippet
      FROM native_history_fts
      JOIN native_history_messages m ON m.id = native_history_fts.rowid
      JOIN sessions s ON s.id = m.session_id
      WHERE native_history_fts MATCH @query AND s.hidden_at IS NULL
      ORDER BY rank LIMIT @limit`
      )
      .all({ query, limit }) as SearchHitRow[]
  }
}
