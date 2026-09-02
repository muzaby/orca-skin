// Row shapes that mirror the SQL schema (snake_case) plus insert DTOs that the
// rest of main code consumes (camelCase). Kept narrow on purpose — wide row
// types would leak into renderer via IPC and force a second mapping anyway.

import type { Backend } from '../../../shared/ipc'

type MessageRole = 'user' | 'assistant'
export type SessionTitleSource = 'auto' | 'user'

// message_parts.type — AppMessagePart(provider-runtime.md §7)의 DB 표현. payload_json 은
// type 외 나머지 필드의 JSON 직렬화(tool_run_id 는 별도 컬럼이라 payload 에 중복 저장 안 함).
type MessagePartType =
  | 'text'
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'file'
  | 'diff'
  | 'structured_output'
  | 'error'
  | 'attachment'
  | 'compact_boundary'
  | 'fork_boundary'
  // 백그라운드 서브에이전트 완료 통지(0143) — payload 에 status/durationMs/summary, tool_run_id
  // 컬럼 = 부모 Task toolRunId(렌더 시 tool_call args 와 조인 키).
  | 'subagent_notice'

export interface SessionRow {
  id: string
  backend: Backend
  title: string | null
  created_at: number
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
  title_source: SessionTitleSource
  provider_key: string | null
  cwd: string | null
  // 0017 — 추가 참조 경로 JSON 배열 문자열. NULL = 없음.
  extra_dirs: string | null
  baseline_oid: string | null
}

export interface SessionListRow {
  id: string
  backend: Backend
  title: string | null
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
  title_source: SessionTitleSource
  provider_key: string | null
  cwd: string | null
  extra_dirs: string | null
  pinned_at: number | null
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
  // SDK 실측 컨텍스트 윈도우(0149). NULL = 실측 미보유 → 복원 시 모델명 폴백.
  contextWindow: number | null
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
  context_window: number | null
}

export interface UsageSumRow {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  total_cost_usd: number
}

// 1일/주/월 경계별 사용량 합산 — 단일 테이블 스캔(조건부 SUM)으로 3구간을 한 번에 집계한다.
export interface UsageByBoundaries {
  day: UsageSumRow
  week: UsageSumRow
  month: UsageSumRow
}

// provider 한정 집계(0186) — 위 3구간 + **원격 기준선 이후 월간 증분**(USD).
// 증분을 WHERE 하한이 아니라 별도 컬럼으로 두는 이유는 `queries.ts` 의 해당 메서드 주석 참조
// (하한을 올리면 같은 스캔의 week 가 깨진다).
export interface ProviderUsageByBoundaries extends UsageByBoundaries {
  monthDeltaCostUsd: number
}

// 원격 사용량 스냅샷 한 행 (마이그레이션 0014 `provider_usage_report_cache`).
// report_json 은 코어가 정한 봉투다 — `{ baselineUsable, raw }`. 스칼라로 접히지 않은 원격
// 응답을 raw 가 통째로 보존하고, baselineUsable 은 기준선 사용 가부를 재시작 후에도 남긴다.
export interface ProviderUsageReportRow {
  provider_key: string
  report_json: string
  fetched_at: number
  as_of: number | null
  quota_limit_usd: number | null
  quota_used_usd: number | null
  quota_remaining_usd: number | null
  updated_at: number
}

export interface ProviderUsageReportUpsert {
  providerKey: string
  reportJson: string
  fetchedAt: number
  asOf: number | null
  quotaLimitUsd: number | null
  quotaUsedUsd: number | null
  quotaRemainingUsd: number | null
  updatedAt: number
}

// 사용량 요약(0112) — since 이후 로컬 일자별 합산 한 행. day = date(...,'localtime') 'YYYY-MM-DD'.
export interface DailyUsageRow extends UsageSumRow {
  day: string
}

// 사용량 요약(0112) — since 이후 모델별 합산 한 행(turn_model_usage ⨝ turn_usage).
export interface ModelUsageSumRow {
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  cost_usd: number
}

export type ScheduleRunStatus = 'running' | 'success' | 'error' | 'skipped'

export interface ScheduleRunRow {
  id: number
  job_key: string
  started_at: number
  finished_at: number | null
  status: ScheduleRunStatus
  error: string | null
}

export interface ScheduleRunStartedInsert {
  jobKey: string
  startedAt: number
}

export interface ScheduleRunFinish {
  id: number
  finishedAt: number
  status: Exclude<ScheduleRunStatus, 'running'>
  error: string | null
}

export interface ProjectRow {
  id: string
  name: string
  instructions: string
  created_at: number
  updated_at: number
  pinned_at: number | null
}

export interface ProjectInsert {
  id: string
  name: string
  instructions: string
  createdAt: number
}

// 0064 continuity — fork/handoff 로 파생된 세션의 부모 관계 (session_lineage).
export type LineageRelation = 'fork' | 'handoff'

export interface SessionLineageInsert {
  childSessionId: string
  parentSessionId: string
  relation: LineageRelation
  // 점-분기(특정 메시지 절단) 후속용 — v1 전체 분기는 null.
  forkPointMessageIdx: number | null
  createdAt: number
}

export interface SessionLineageRow {
  child_session_id: string
  parent_session_id: string
  relation: LineageRelation
  fork_point_message_idx: number | null
  created_at: number
}

export interface SessionInsert {
  id: string
  backend: Backend
  title: string | null
  projectId: string | null
  createdAt: number
  providerKey?: string | null
  cwd?: string | null
  // 추가 참조 경로. 빈 배열/미지정이면 NULL 로 저장한다.
  extraDirs?: string[] | null
  // 세션 출생 시점의 diff 기준. 이후 metadata update는 이 값을 바꾸지 않는다.
  baselineOid?: string | null
}

export interface ManagedWorktreeRow {
  id: string
  session_id: string | null
  repo_root: string
  source_cwd: string
  worktree_root: string
  branch: string
  base_oid: string
  created_at: number
}

export interface ManagedWorktreeInsert {
  id: string
  repoRoot: string
  sourceCwd: string
  worktreeRoot: string
  branch: string
  baseOid: string
  createdAt: number
}

export interface MessageInsert {
  sessionId: string
  role: MessageRole
  content: string
  createdAt: number
  complete?: 0 | 1
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
export interface DanglingToolCallRow {
  session_id: string
  message_id: number
  tool_run_id: string
  payload_json: string
}

// 미완(complete=0) assistant 메시지의 text 파트 — finalize 이전 종료로 비어 있을 수 있는
// content(FTS 캐시)를 부팅/세션 복구가 재구성하는 데 쓴다(0107).
export interface IncompleteAssistantTextPartRow {
  message_id: number
  payload_json: string
}

export interface LoadedPartRow {
  message_id: number
  role: MessageRole
  created_at: number
  complete: 0 | 1
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
