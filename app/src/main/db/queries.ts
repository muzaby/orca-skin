import type Database from 'better-sqlite3'
import type {
  MessageInsert,
  MessageRow,
  ProjectInsert,
  ProjectRow,
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
  private readonly listProjectsStmt: Database.Statement
  private readonly getProjectStmt: Database.Statement
  private readonly insertProjectStmt: Database.Statement
  private readonly updateProjectStmt: Database.Statement
  private readonly deleteProjectStmt: Database.Statement
  private readonly listSessionsByProjectStmt: Database.Statement
  // 매 chat:send 마다 1회 호출 — sessionId 에서 소속 프로젝트의 instructions 한 방에 조회.
  private readonly getProjectInstructionsForSessionStmt: Database.Statement

  constructor(db: Database.Database) {
    this.insertSessionStmt = db.prepare(`
      INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview)
      VALUES (@id, @backend, @title, @projectId, @createdAt, @createdAt, NULL)
      ON CONFLICT(id) DO NOTHING
    `)
    this.listSessionsStmt = db.prepare(`
      SELECT id, backend, title, updated_at, last_message_preview, project_id
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
    this.listProjectsStmt = db.prepare(`
      SELECT id, name, instructions, created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC
    `)
    this.getProjectStmt = db.prepare(`
      SELECT id, name, instructions, created_at, updated_at
      FROM projects
      WHERE id = @id
    `)
    this.insertProjectStmt = db.prepare(`
      INSERT INTO projects (id, name, instructions, created_at, updated_at)
      VALUES (@id, @name, @instructions, @createdAt, @createdAt)
    `)
    // 부분 업데이트 — name / instructions 둘 다 nullable 인자. NULL 이면 기존 값 유지.
    this.updateProjectStmt = db.prepare(`
      UPDATE projects
      SET name = COALESCE(@name, name),
          instructions = COALESCE(@instructions, instructions),
          updated_at = @updatedAt
      WHERE id = @id
    `)
    this.deleteProjectStmt = db.prepare(`DELETE FROM projects WHERE id = @id`)
    this.listSessionsByProjectStmt = db.prepare(`
      SELECT id, backend, title, updated_at, last_message_preview, project_id
      FROM sessions
      WHERE project_id = @projectId
      ORDER BY updated_at DESC
    `)
    this.getProjectInstructionsForSessionStmt = db.prepare(`
      SELECT p.instructions AS instructions
      FROM projects p
      JOIN sessions s ON s.project_id = p.id
      WHERE s.id = @sessionId
    `)
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

  listProjects(): ProjectRow[] {
    return this.listProjectsStmt.all() as ProjectRow[]
  }

  getProject(id: string): ProjectRow | null {
    const row = this.getProjectStmt.get({ id }) as ProjectRow | undefined
    return row ?? null
  }

  insertProject(row: ProjectInsert): void {
    this.insertProjectStmt.run(row)
  }

  // name / instructions 둘 다 undefined 면 updated_at 만 갱신되지만, 호출 측에서
  // 최소 하나는 채워 보내는 게 일반적이다. SQLite 의 named bind 는 missing key 를
  // 거부하므로 호출자가 빠진 키도 명시적으로 null 로 전달해야 한다.
  updateProject(
    id: string,
    patch: { name?: string; instructions?: string },
    updatedAt: number
  ): void {
    this.updateProjectStmt.run({
      id,
      name: patch.name ?? null,
      instructions: patch.instructions ?? null,
      updatedAt
    })
  }

  deleteProject(id: string): void {
    this.deleteProjectStmt.run({ id })
  }

  listSessionsByProject(projectId: string): SessionListRow[] {
    return this.listSessionsByProjectStmt.all({ projectId }) as SessionListRow[]
  }

  getProjectInstructionsForSession(sessionId: string): string | null {
    const row = this.getProjectInstructionsForSessionStmt.get({ sessionId }) as
      | { instructions: string }
      | undefined
    return row?.instructions ?? null
  }
}
