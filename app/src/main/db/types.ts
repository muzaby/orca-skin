// Row shapes that mirror the SQL schema (snake_case) plus insert DTOs that the
// rest of main code consumes (camelCase). Kept narrow on purpose — wide row
// types would leak into renderer via IPC and force a second mapping anyway.

import type { Backend } from '../../shared/ipc'

export type MessageRole = 'user' | 'assistant'

// message_parts.type — AppMessagePart(provider-runtime.md §7)의 DB 표현. payload_json 은
// type 외 나머지 필드의 JSON 직렬화(tool_run_id 는 별도 컬럼이라 payload 에 중복 저장 안 함).
export type MessagePartType =
  | 'text'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'file'
  | 'diff'
  | 'structured_output'
  | 'error'

export interface SessionRow {
  id: string
  backend: Backend
  title: string | null
  created_at: number
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
}

export interface SessionListRow {
  id: string
  backend: Backend
  title: string | null
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
}

// 0006 turn_usage — per-turn 사용량 원장. 모델별 분해는 turn_model_usage 자식 행에 저장.
export interface TurnUsageInsert {
  sessionId: string | null
  messageId: number | null
  createdAt: number
  inputTokens: number | null
  outputTokens: number | null
  cacheCreationInputTokens: number | null
  cacheReadInputTokens: number | null
  totalCostUsd: number | null
}

export interface TurnUsageRow {
  id: number
  session_id: string | null
  message_id: number | null
  created_at: number
  input_tokens: number | null
  output_tokens: number | null
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
  total_cost_usd: number | null
}

export interface TurnModelUsageInsert {
  turnUsageId: number
  model: string
  inputTokens: number | null
  outputTokens: number | null
  cacheCreationInputTokens: number | null
  cacheReadInputTokens: number | null
  costUsd: number | null
}

export interface TurnModelUsageRow {
  id: number
  turn_usage_id: number
  model: string
  input_tokens: number | null
  output_tokens: number | null
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
  cost_usd: number | null
}

export interface UsageSumRow {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  total_cost_usd: number
}

export interface ProjectRow {
  id: string
  name: string
  instructions: string
  created_at: number
  updated_at: number
}

export interface ProjectInsert {
  id: string
  name: string
  instructions: string
  createdAt: number
}

export interface MessageRow {
  id: number
  session_id: string
  role: MessageRole
  content: string
  created_at: number
  idx: number
}

// 한 메시지에 속한 순서 보존 파트 한 행. payload_json 은 type 별 페이로드 JSON.
export interface MessagePartRow {
  id: number
  message_id: number
  idx: number
  type: MessagePartType
  tool_run_id: string | null
  payload_json: string
}

export interface SessionInsert {
  id: string
  backend: Backend
  title: string | null
  projectId: string | null
  createdAt: number
}

export interface MessageInsert {
  sessionId: string
  role: MessageRole
  content: string
  createdAt: number
}

// 파트 append DTO. idx 는 SQL 이 message 내 MAX(idx)+1 로 자동 부여(호출자 미지정).
export interface MessagePartInsert {
  messageId: number
  type: MessagePartType
  toolRunId: string | null
  payloadJson: string
}

// loadParts 의 한 행 — message_parts 를 messages 와 조인해 메시지 메타(role/순서)를 함께 싣는다.
// message_idx(메시지 순서) → part_idx(파트 순서)로 정렬해 세션 전체 파트를 재구성한다.
export interface LoadedPartRow {
  message_id: number
  role: MessageRole
  created_at: number
  message_idx: number
  part_idx: number
  type: MessagePartType
  tool_run_id: string | null
  payload_json: string
}

// FTS5 검색 결과 한 행. snippet 은 SQLite snippet() 가 생성한 `<mark>…</mark>`
// 포함 짧은 발췌. 렌더러는 split 으로 파싱 후 React 노드로 재구성한다 (XSS 방어).
export interface SearchHitRow {
  message_id: number
  session_id: string
  role: MessageRole
  created_at: number
  session_title: string | null
  snippet: string
}
