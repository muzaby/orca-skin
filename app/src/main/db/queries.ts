import type Database from 'better-sqlite3'
import type {
  MessageInsert,
  MessageRow,
  SessionInsert,
  SessionListRow,
  ToolCallInsert,
  ToolCallRow,
  ToolCallStatus
} from './types'

export class DbQueries {
  private readonly insertSessionStmt: Database.Statement
  private readonly listSessionsStmt: Database.Statement
  private readonly loadMessagesStmt: Database.Statement
  private readonly loadToolCallsStmt: Database.Statement
  private readonly appendMessageStmt: Database.Statement
  private readonly updateMessageContentStmt: Database.Statement
  private readonly appendToolCallStmt: Database.Statement
  private readonly updateToolCallResultStmt: Database.Statement
  private readonly updateSessionPreviewStmt: Database.Statement
  private readonly updateSessionTitleStmt: Database.Statement
  // 사용자가 명시적으로 rename — 기존 title 이 있어도 덮어쓴다.
  // updateSessionTitleStmt 는 첫 init 시점 채우기 용도 (WHERE title IS NULL).
  private readonly renameSessionStmt: Database.Statement
  private readonly deleteSessionStmt: Database.Statement

  constructor(db: Database.Database) {
    this.insertSessionStmt = db.prepare(`
      INSERT INTO sessions (id, backend, title, created_at, updated_at, last_message_preview)
      VALUES (@id, @backend, @title, @createdAt, @createdAt, NULL)
      ON CONFLICT(id) DO NOTHING
    `)
    this.listSessionsStmt = db.prepare(`
      SELECT id, backend, title, updated_at, last_message_preview
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT @limit
    `)
    this.loadMessagesStmt = db.prepare(`
      SELECT id, session_id, role, content, created_at, idx
      FROM messages
      WHERE session_id = @sessionId
      ORDER BY idx ASC
    `)
    this.loadToolCallsStmt = db.prepare(`
      SELECT tc.id, tc.message_id, tc.tool_use_id, tc.name, tc.input_json, tc.result_json, tc.status
      FROM tool_calls tc
      JOIN messages m ON tc.message_id = m.id
      WHERE m.session_id = @sessionId
      ORDER BY tc.id ASC
    `)
    this.appendMessageStmt = db.prepare(`
      INSERT INTO messages (session_id, role, content, created_at, idx)
      VALUES (
        @sessionId,
        @role,
        @content,
        @createdAt,
        COALESCE((SELECT MAX(idx) + 1 FROM messages WHERE session_id = @sessionId), 0)
      )
    `)
    this.updateMessageContentStmt = db.prepare(`
      UPDATE messages SET content = @content WHERE id = @id
    `)
    this.appendToolCallStmt = db.prepare(`
      INSERT INTO tool_calls (message_id, tool_use_id, name, input_json, result_json, status)
      VALUES (@messageId, @toolUseId, @name, @inputJson, NULL, 'pending')
    `)
    this.updateToolCallResultStmt = db.prepare(`
      UPDATE tool_calls
      SET result_json = @resultJson, status = @status
      WHERE tool_use_id = @toolUseId
    `)
    this.updateSessionPreviewStmt = db.prepare(`
      UPDATE sessions
      SET last_message_preview = @preview, updated_at = @updatedAt
      WHERE id = @id
    `)
    this.updateSessionTitleStmt = db.prepare(`
      UPDATE sessions SET title = @title WHERE id = @id AND title IS NULL
    `)
    this.renameSessionStmt = db.prepare(`
      UPDATE sessions SET title = @title, updated_at = @updatedAt WHERE id = @id
    `)
    this.deleteSessionStmt = db.prepare(`DELETE FROM sessions WHERE id = @id`)
  }

  insertSession(row: SessionInsert): void {
    this.insertSessionStmt.run(row)
  }

  listSessions(limit = 50): SessionListRow[] {
    return this.listSessionsStmt.all({ limit }) as SessionListRow[]
  }

  loadMessages(sessionId: string): MessageRow[] {
    return this.loadMessagesStmt.all({ sessionId }) as MessageRow[]
  }

  loadToolCalls(sessionId: string): ToolCallRow[] {
    return this.loadToolCallsStmt.all({ sessionId }) as ToolCallRow[]
  }

  appendMessage(row: MessageInsert): number {
    const info = this.appendMessageStmt.run(row)
    return Number(info.lastInsertRowid)
  }

  updateMessageContent(id: number, content: string): void {
    this.updateMessageContentStmt.run({ id, content })
  }

  appendToolCall(row: ToolCallInsert): number {
    const info = this.appendToolCallStmt.run(row)
    return Number(info.lastInsertRowid)
  }

  updateToolCallResult(toolUseId: string, resultJson: string, status: ToolCallStatus): void {
    this.updateToolCallResultStmt.run({ toolUseId, resultJson, status })
  }

  updateSessionPreview(id: string, preview: string, updatedAt: number): void {
    this.updateSessionPreviewStmt.run({ id, preview, updatedAt })
  }

  updateSessionTitle(id: string, title: string): void {
    this.updateSessionTitleStmt.run({ id, title })
  }

  renameSession(id: string, title: string, updatedAt: number): void {
    this.renameSessionStmt.run({ id, title, updatedAt })
  }

  deleteSession(id: string): void {
    this.deleteSessionStmt.run({ id })
  }
}
