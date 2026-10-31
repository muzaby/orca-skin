import type Database from 'better-sqlite3'
import type { SearchHitRow } from './types'

export interface NativeSnapshotRow {
  payload_json: string
  cursor_json: string | null
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

export interface NativeRecoveryRow {
  native_id: string
  archive_json: string
  local_frontier: number
  fresh_start: number
  prompt_id: string | null
  prompt_text: string | null
  accepted: number
}

/** Native formats stay outside infra. Snapshot and search rows commit together. */
export class NativeHistoryQueries {
  private readonly statements: {
    recovery: Database.Statement
    visible: Database.Statement
    saveRecovery: Database.Statement
    deleteSnapshot: Database.Statement
    deleteMessages: Database.Statement
    insertMessage: Database.Statement
    recoveryPrompt: Database.Statement
    acceptRecovery: Database.Statement
    observe: Database.Statement
    get: Database.Statement
    bind: Database.Statement
    bindings: Database.Statement
    replace: Database.Statement
    deleteMissing: Database.Statement
    upsertMessage: Database.Statement
    search: Database.Statement
  }

  constructor(private readonly db: Database.Database) {
    this.statements = {
      recovery: db.prepare('SELECT * FROM native_session_recovery WHERE session_id = ?'),
      visible: db.prepare('SELECT 1 FROM sessions WHERE id = ? AND hidden_at IS NULL'),
      saveRecovery: db.prepare(`INSERT INTO native_session_recovery
        (session_id, native_id, archive_json, local_frontier, fresh_start)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET
        native_id=excluded.native_id, archive_json=excluded.archive_json,
        local_frontier=excluded.local_frontier, fresh_start=excluded.fresh_start,
        prompt_id=NULL, prompt_text=NULL, accepted=0`),
      deleteSnapshot: db.prepare('DELETE FROM native_history_snapshots WHERE session_id = ?'),
      deleteMessages: db.prepare('DELETE FROM native_history_messages WHERE session_id = ?'),
      insertMessage: db.prepare(`INSERT INTO native_history_messages
        (session_id, native_id, role, created_at, content) VALUES (?, ?, ?, ?, ?)`),
      recoveryPrompt: db.prepare(`UPDATE native_session_recovery SET prompt_id=?, prompt_text=?
      WHERE session_id=? AND accepted=0`),
      acceptRecovery: db.prepare(`UPDATE native_session_recovery SET accepted=1, fresh_start=0
      WHERE session_id=? AND prompt_id=?`),
      observe: db.prepare(`SELECT total_changes() AS version,
      COALESCE((SELECT MAX(id) FROM messages WHERE session_id = ?), 0) AS frontier`),
      get: db.prepare(
        'SELECT payload_json, cursor_json, local_frontier, synced_at FROM native_history_snapshots WHERE session_id = ?'
      ),
      bind: db.prepare(
        'INSERT OR IGNORE INTO native_message_bindings (message_id, native_message_id) VALUES (?, ?)'
      ),
      bindings: db.prepare(`SELECT b.message_id, b.native_message_id
      FROM native_message_bindings b JOIN messages m ON m.id = b.message_id
      WHERE m.session_id = ? ORDER BY m.idx`),
      replace:
        db.prepare(`INSERT INTO native_history_snapshots (session_id, payload_json, local_frontier, synced_at, cursor_json)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET
        payload_json=excluded.payload_json, local_frontier=excluded.local_frontier, synced_at=excluded.synced_at, cursor_json=excluded.cursor_json`),
      deleteMissing: db.prepare(
        "DELETE FROM native_history_messages WHERE session_id = ? AND native_id NOT LIKE 'orca-recovery:%' AND native_id NOT IN (SELECT value FROM json_each(?))"
      ),
      upsertMessage: db.prepare(`INSERT INTO native_history_messages
        (session_id, native_id, role, created_at, content) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id, native_id) DO UPDATE SET role=excluded.role, created_at=excluded.created_at, content=excluded.content
        WHERE native_history_messages.role IS NOT excluded.role OR native_history_messages.created_at IS NOT excluded.created_at OR native_history_messages.content IS NOT excluded.content`),
      search: db.prepare(`SELECT -m.id AS message_id, m.session_id, m.role, m.created_at,
        s.title AS session_title,
        snippet(native_history_fts, 0, '<mark>', '</mark>', '…', 24) AS snippet
      FROM native_history_fts
      JOIN native_history_messages m ON m.id = native_history_fts.rowid
      JOIN sessions s ON s.id = m.session_id
      WHERE native_history_fts MATCH @query AND s.hidden_at IS NULL
      ORDER BY rank LIMIT @limit`)
    }
  }

  recovery(sessionId: string): NativeRecoveryRow | undefined {
    return this.statements.recovery.get(sessionId) as NativeRecoveryRow | undefined
  }

  prepareRecovery(input: {
    sessionId: string
    nativeId: string
    freshStart: boolean
    archiveJson: string
    frontier: number
    expectedVersion: number
    messages: SearchableNativeMessage[]
  }): void {
    this.db.transaction(() => {
      if (
        this.observe(input.sessionId).version !== input.expectedVersion ||
        !this.statements.visible.get(input.sessionId)
      )
        throw new Error('Conversation changed during native recovery')
      this.statements.saveRecovery.run(
        input.sessionId,
        input.nativeId,
        input.archiveJson,
        input.frontier,
        Number(input.freshStart)
      )
      this.statements.deleteSnapshot.run(input.sessionId)
      this.statements.deleteMessages.run(input.sessionId)
      const insert = this.statements.insertMessage
      input.messages.forEach((message, index) =>
        insert.run(
          input.sessionId,
          `orca-recovery:${index}`,
          message.role,
          message.createdAt,
          message.content
        )
      )
    })()
  }

  recoveryPrompt(sessionId: string, nativeMessageId: string, visibleText: string): void {
    this.statements.recoveryPrompt.run(nativeMessageId, visibleText, sessionId)
  }

  acceptRecovery(sessionId: string, nativeMessageId: string): void {
    this.statements.acceptRecovery.run(sessionId, nativeMessageId)
  }

  observe(sessionId: string): { version: number; frontier: number } {
    return this.statements.observe.get(sessionId) as { version: number; frontier: number }
  }

  get(sessionId: string): NativeSnapshotRow | undefined {
    return this.statements.get.get(sessionId) as NativeSnapshotRow | undefined
  }

  bind(messageId: number, nativeMessageId: string): void {
    this.statements.bind.run(messageId, nativeMessageId)
  }

  bindings(sessionId: string): NativeMessageBinding[] {
    return this.statements.bindings.all(sessionId) as NativeMessageBinding[]
  }

  replace(input: {
    sessionId: string
    payloadJson: string
    cursorJson?: string
    frontier: number
    expectedVersion: number
    messages: SearchableNativeMessage[]
    now: number
  }): boolean {
    return this.db.transaction(() => {
      if (this.observe(input.sessionId).version !== input.expectedVersion) return false
      if (!this.statements.visible.get(input.sessionId)) return false
      this.statements.replace.run(
        input.sessionId,
        input.payloadJson,
        input.frontier,
        input.now,
        input.cursorJson ?? null
      )
      this.statements.deleteMissing.run(
        input.sessionId,
        JSON.stringify(input.messages.map((message) => message.id))
      )
      const insert = this.statements.upsertMessage
      for (const message of input.messages) {
        insert.run(input.sessionId, message.id, message.role, message.createdAt, message.content)
      }
      return true
    })()
  }

  search(query: string, limit: number): SearchHitRow[] {
    return this.statements.search.all({ query, limit }) as SearchHitRow[]
  }
}
