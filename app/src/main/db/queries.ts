import type Database from 'better-sqlite3'
import type {
  LoadedPartRow,
  MessageInsert,
  MessagePartInsert,
  ProjectInsert,
  ProjectRow,
  SearchHitRow,
  SessionInsert,
  SessionListRow,
  UsageEventInsert,
  UsageRow
} from './types'

export class DbQueries {
  private readonly insertSessionStmt: Database.Statement
  private readonly listSessionsStmt: Database.Statement
  private readonly loadPartsStmt: Database.Statement
  private readonly appendMessageStmt: Database.Statement
  private readonly updateMessageContentStmt: Database.Statement
  private readonly appendPartStmt: Database.Statement
  private readonly updateToolResultPartStmt: Database.Statement
  private readonly updateSessionPreviewStmt: Database.Statement
  private readonly updateSessionTitleStmt: Database.Statement
  // per-turn 사용량 원장 — insert(턴 종료) + 세션 최신 행 조회(컨텍스트 도넛/패널 복원).
  private readonly insertUsageEventStmt: Database.Statement
  private readonly getLatestUsageStmt: Database.Statement
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
  // FTS5 검색 — messages_fts virtual table 을 messages + sessions 와 조인.
  private readonly searchMessagesStmt: Database.Statement

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
    this.loadPartsStmt = db.prepare(`
      SELECT
        m.id AS message_id,
        m.role AS role,
        m.created_at AS created_at,
        m.idx AS message_idx,
        mp.idx AS part_idx,
        mp.type AS type,
        mp.tool_run_id AS tool_run_id,
        mp.payload_json AS payload_json
      FROM messages m
      JOIN message_parts mp ON mp.message_id = m.id
      WHERE m.session_id = @sessionId
      ORDER BY m.idx ASC, mp.idx ASC
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
    // 파트 append — idx 는 같은 message 내 MAX(idx)+1 로 자동 부여(호출자 미지정).
    this.appendPartStmt = db.prepare(`
      INSERT INTO message_parts (message_id, idx, type, tool_run_id, payload_json)
      VALUES (
        @messageId,
        COALESCE((SELECT MAX(idx) + 1 FROM message_parts WHERE message_id = @messageId), 0),
        @type,
        @toolRunId,
        @payloadJson
      )
    `)
    // tool_result 파트 갱신 — 같은 toolRunId 의 결과를 in-place 로 덮어쓴다(AskUserQuestion
    // 합성 후 실제 tool_result 가 늦게 와도 중복 행을 만들지 않게). 0행이면 호출자가 append.
    this.updateToolResultPartStmt = db.prepare(`
      UPDATE message_parts
      SET payload_json = @payloadJson
      WHERE tool_run_id = @toolRunId AND type = 'tool_result'
    `)
    this.updateSessionPreviewStmt = db.prepare(`
      UPDATE sessions
      SET last_message_preview = @preview, updated_at = @updatedAt
      WHERE id = @id
    `)
    this.updateSessionTitleStmt = db.prepare(`
      UPDATE sessions SET title = @title WHERE id = @id AND title IS NULL
    `)
    this.insertUsageEventStmt = db.prepare(`
      INSERT INTO usage_events
        (session_id, model, created_at, input_tokens, output_tokens,
         cache_read_tokens, cache_creation_tokens, cost_usd)
      VALUES
        (@sessionId, @model, @createdAt, @inputTokens, @outputTokens,
         @cacheReadTokens, @cacheCreationTokens, @costUsd)
    `)
    // 세션의 마지막 턴 사용량 — 컨텍스트 도넛/패널을 세션 로드 시 복원.
    this.getLatestUsageStmt = db.prepare(`
      SELECT * FROM usage_events WHERE session_id = @sessionId ORDER BY created_at DESC LIMIT 1
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
    this.searchMessagesStmt = db.prepare(`
      SELECT
        m.id AS message_id,
        m.session_id,
        m.role,
        m.created_at,
        s.title AS session_title,
        snippet(messages_fts, 0, '<mark>', '</mark>', '…', 24) AS snippet
      FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid
      JOIN sessions s ON s.id = m.session_id
      WHERE messages_fts MATCH @query
      ORDER BY rank
      LIMIT @limit
    `)
  }

  insertSession(row: SessionInsert): void {
    this.insertSessionStmt.run(row)
  }

  listSessions(limit = 50): SessionListRow[] {
    return this.listSessionsStmt.all({ limit }) as SessionListRow[]
  }

  loadParts(sessionId: string): LoadedPartRow[] {
    return this.loadPartsStmt.all({ sessionId }) as LoadedPartRow[]
  }

  appendMessage(row: MessageInsert): number {
    const info = this.appendMessageStmt.run(row)
    return Number(info.lastInsertRowid)
  }

  // messages.content 는 text/reasoning parts 의 concat 캐시(FTS5 색인용). 파트 append 와
  // 별개로 호출해 캐시를 동기화한다.
  updateMessageContent(id: number, content: string): void {
    this.updateMessageContentStmt.run({ id, content })
  }

  appendPart(row: MessagePartInsert): number {
    const info = this.appendPartStmt.run(row)
    return Number(info.lastInsertRowid)
  }

  // tool_result 파트 upsert — 같은 toolRunId 가 있으면 갱신, 없으면 append. messageId 는
  // append 폴백에만 쓰인다(현재 assistant 메시지).
  upsertToolResultPart(messageId: number, toolRunId: string, payloadJson: string): void {
    const info = this.updateToolResultPartStmt.run({ toolRunId, payloadJson })
    if (info.changes === 0) {
      this.appendPart({ messageId, type: 'tool_result', toolRunId, payloadJson })
    }
  }

  updateSessionPreview(id: string, preview: string, updatedAt: number): void {
    this.updateSessionPreviewStmt.run({ id, preview, updatedAt })
  }

  updateSessionTitle(id: string, title: string): void {
    this.updateSessionTitleStmt.run({ id, title })
  }

  // 턴 종료 시 사용량 1행 적재. 시간/모델별 집계 + 세션 최신 행 복원의 원천.
  insertUsageEvent(row: UsageEventInsert): void {
    this.insertUsageEventStmt.run(row)
  }

  // 세션의 마지막 턴 사용량 행(없으면 undefined). 컨텍스트 도넛/패널 복원용.
  getLatestUsage(sessionId: string): UsageRow | undefined {
    return this.getLatestUsageStmt.get({ sessionId }) as UsageRow | undefined
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

  // 사용자 입력어를 FTS5 MATCH 표현식으로 안전하게 변환 후 검색.
  // 입력어가 비어 있거나 quote 처리 후 empty 면 빈 결과 반환.
  searchMessages(rawQuery: string, limit = 30): SearchHitRow[] {
    const fts = toFtsMatch(rawQuery)
    if (!fts) return []
    return this.searchMessagesStmt.all({ query: fts, limit }) as SearchHitRow[]
  }
}

// 사용자 입력을 FTS5 MATCH 식으로 변환. 공백 기준 토큰 분리 후 각 토큰을 quote 로
// 감싸 AND / OR / NEAR / NOT / 콜론 등 FTS5 연산자를 리터럴로 취급. 모든 토큰에
// `*` prefix wildcard 부착 — 사용자가 어느 토큰이든 미완성으로 타이핑 중일 수 있다는
// 가정 (예: "함 호" → "함수 호출" 매칭). 짧은 토큰의 매치 폭증은 LIMIT + FTS5 rank
// 정렬로 흡수. 토큰이 0개면 null (호출자가 빈 결과 처리).
function toFtsMatch(raw: string): string | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '')
  if (tokens.length === 0) return null
  return tokens.map((t) => '"' + t.replace(/"/g, '""') + '"*').join(' ')
}
