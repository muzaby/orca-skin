// IPC 채널 이름 + 순수 TS 타입. zod 의존 없음 — preload (sandbox=true) 와 renderer 모두 안전하게 import.
// main 프로세스의 런타임 검증 (zod 스키마) 은 ./protocol.ts 에 별도로 둔다.

// 권한 모드 정규화 타입 (type-only — 런타임 사이클 없음). permission-mode.ts 와 상호 type import.
import type { NormalizedPermissionMode } from './permission-mode'

// Phase 2 활성 채널 (preload 노출 대상). 미사용 채널은 의도적으로 누락.
export const CHANNELS = {
  chatSend: 'orca:chat:send',
  chatEvent: 'orca:chat:event',
  chatCancel: 'orca:chat:cancel',
  backendList: 'orca:backend:list',
  installStart: 'orca:install:start',
  installStatus: 'orca:install:status',
  settingsGet: 'orca:settings:get',
  settingsSet: 'orca:settings:set',
  skillsList: 'orca:skills:list',
  filesList: 'orca:files:list',
  sessionCwd: 'orca:session:cwd',
  sessionList: 'orca:session:list',
  sessionLoad: 'orca:session:load',
  sessionDelete: 'orca:session:delete',
  sessionRename: 'orca:session:rename',
  projectList: 'orca:project:list',
  projectCreate: 'orca:project:create',
  projectUpdate: 'orca:project:update',
  projectDelete: 'orca:project:delete',
  projectListSessions: 'orca:project:listSessions',
  windowMinimize: 'orca:window:minimize',
  windowMaximize: 'orca:window:maximize',
  windowClose: 'orca:window:close',
  searchMessages: 'orca:search:messages',
  mcpList: 'orca:mcp:list',
  mcpAdd: 'orca:mcp:add',
  mcpUpdate: 'orca:mcp:update',
  mcpDelete: 'orca:mcp:delete',
  runtimeStatus: 'orca:runtime:status',
  runtimePrepare: 'orca:runtime:prepare',
  runtimeStatusEvent: 'orca:runtime:statusEvent',
  costSummary: 'orca:cost:summary',
  costSummaryEvent: 'orca:cost:summaryEvent',
  // 권한 응답 단일 채널 — ask/plan/tool 세 종류의 승인 응답이 모두 이 채널로 흐른다
  // (askRespond/planRespond 2채널 통합). 응답 = { approvalId, resolution: ApprovalResolution }.
  permissionRespond: 'orca:permission:respond',
  // 세션 진행 중 권한 모드 라이브 전환 (PR③). { sessionId, mode } 를 main 에 invoke —
  // 진행 중 턴이면 즉시 Query.setPermissionMode, 아니면 controller 에 기록해 다음 턴에 반영.
  permissionSetMode: 'orca:permission:setMode'
} as const

// Backend (Phase 2: claude-code 단일. opencode 는 future work)
export type Backend = 'claude-code'

// 에러 분류 (provider-runtime.md §6 정본). 와이어 error 이벤트는 8 category + retryable 로
// 정규화된 ClassifiedError 를 싣는다 — 재시도/표시 정책을 category 로 결정한다. 구 ErrorCode
// (sdk.*/auth.expired/protocol.parse/internal) 는 ErrorClassifier 도입과 함께 제거됐다.
// claude-only 단계에서는 claude 가 실제 생성하는 부분집합(auth_error·provider_connection_error·
// stream_error·schema_validation_error·user_cancelled)만 능동 생성되고 나머지는 seam(OpenCode
// 어댑터 도입 시 채운다).
export type ErrorCategory =
  | 'provider_connection_error' // OpenCode 서버 다운, Claude 바이너리 부재
  | 'auth_error' // API key 무효/누락 (구 auth.expired — 재로그인 모달 분기)
  | 'permission_denied' // user deny / policy deny
  | 'tool_execution_error' // shell exit≠0, file read 실패
  | 'stream_error' // SSE 끊김, iterator 오류
  | 'capability_unsupported' // 예: Claude 에 OpenCode식 find.* 없음
  | 'schema_validation_error' // structured output / IPC payload 검증 실패
  | 'user_cancelled' // abort/interrupt (정상 종료 — emit 안 함, 분류만)

// 정규화된 에러 (provider-runtime.md §6 정본). retryable 은 표시/재시도 정책 힌트.
// cause 는 IPC(wc.send structuredClone) 경계를 넘으므로 직렬화 안전값만 담는다 — Error
// 인스턴스/함수 금지(반드시 sanitizeCause 로 평탄화). provider 는 라우팅/표시용 출처.
export interface ClassifiedError {
  category: ErrorCategory
  message: string
  retryable: boolean
  provider?: ProviderId
  cause?: unknown
}

export interface TurnModelUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  costUsd: number
}

export interface TurnUsage {
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  totalCostUsd: number
  contextWindow?: number
  models: TurnModelUsage[]
}

export interface CostUsageTotals {
  costUsd: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

export interface CostSummary {
  day: CostUsageTotals
  week: CostUsageTotals
  month: CostUsageTotals
}

// ── NormalizedEvent (provider-runtime.md §2) — 와이어(orca:chat:event)의 정규 이벤트 ─────────
// 모든 이벤트가 sessionId(멀티세션 라우팅)·provider 를 갖고, tool 은 toolRunId 로 start/complete
// 를 매칭한다. claude 어댑터는 SDK 메시지를 claudeToNormalized(adapters/claude-map.ts)로 이 타입에
// 직접 정규화한다. OpenCode 는 provider:'opencode' 매퍼가 같은 union 으로 정규화(seam).
// 권한 요청은 permission.requested 1급 이벤트(origin 으로 agent/app 구분, action.kind 로 종류 구분).
export type ProviderId = 'claude-code' | 'opencode'

// 권한 요청의 출처. agent = 에이전트 도구 발화(AskUserQuestion·ExitPlanMode·일반 도구),
// app = 앱이 합성한 명령(slash command 등 — AppCommandPolicy 가 분류).
export type PermissionOrigin = 'agent' | 'app'

// provider 중립 권한 액션. claude 의 AskUserQuestion/ExitPlanMode/일반도구를 이 3종으로 합성한다.
export type PermissionAction =
  | { kind: 'ask_question'; request: AskQuestionRequest }
  | { kind: 'plan_review'; request: PlanReviewRequest }
  | { kind: 'tool_approval'; toolName: string; input: unknown }

// 세션 범위 권한 부여(provider-runtime.md §3 updatedPermissions). "세션 동안 허용" 선택 시
// allow.updatedPermissions 에 실려, router 가 sessionAllowedTools(Map<sessionId, Set<toolName>>)
// 를 갱신해 같은 세션의 이후 턴에서 동일 도구를 카드 없이 자동 허용한다. SDK updatedPermissions
// 는 미사용 — 권한 영속은 앱 레벨에서 관리한다.
export interface PermissionUpdate {
  toolName: string
  scope: 'session'
}

// 권한 해소의 2분기(4값 모델 폐기 — provider-runtime.md §3). claude PermissionResult 와 동형:
// allow{updatedInput?} ↔ behavior:'allow', deny{message?,interrupt?} ↔ behavior:'deny'.
export type ApprovalResolution =
  | { behavior: 'allow'; updatedInput?: unknown; updatedPermissions?: PermissionUpdate[] }
  | { behavior: 'deny'; message?: string; interrupt?: boolean }

// renderer → main 단일 권한 응답 (permissionRespond 채널). approvalId 로 보류 중인
// 승인(InteractionBroker)을 라우팅하고, resolution 으로 해소한다.
export interface PermissionRespond {
  approvalId: string
  resolution: ApprovalResolution
}

export type NormalizedEvent =
  | {
      type: 'session.updated'
      sessionId: string
      provider: ProviderId
      patch: { model?: string; cwd?: string }
    }
  | { type: 'message.delta'; sessionId: string; provider: ProviderId; delta: { text: string } }
  | {
      type: 'message.completed'
      sessionId: string
      provider: ProviderId
      message: { text: string }
    }
  // 확장사고(extended thinking) 블록 — provider-runtime.md §7 reasoning part 의 출처.
  // signature 는 멀티턴 재전송 무결성용 opaque 값(해석 금지, 원형 보관).
  | {
      type: 'message.reasoning'
      sessionId: string
      provider: ProviderId
      text: string
      signature?: string
    }
  // 확장사고 라이브 델타(transient — message.delta 와 동형, DB 미저장). 영속은 완성 블록의
  // message.reasoning 이 담당. 런타임이 thinking_delta 를 안 흘리면 발생 안 함(graceful).
  | {
      type: 'message.reasoning.delta'
      sessionId: string
      provider: ProviderId
      delta: { text: string }
    }
  | {
      type: 'tool.call.started'
      sessionId: string
      provider: ProviderId
      toolRunId: string
      toolName: string
      args: unknown
    }
  | {
      type: 'tool.call.completed'
      sessionId: string
      provider: ProviderId
      toolRunId: string
      result: unknown
      isError: boolean
      durationMs?: number
    }
  | {
      type: 'telemetry'
      sessionId: string
      provider: ProviderId
      usage?: TurnUsage
    }
  | {
      type: 'error'
      sessionId?: string
      provider: ProviderId
      error: ClassifiedError
    }
  // 권한 요청/해소 1급 이벤트 — AskUserQuestion·ExitPlanMode·일반 도구 게이트를 단일 경로로 통합.
  // approvalId 로 요청↔응답을 라우팅한다(renderer 는 이 id 로 permissionRespond 회신).
  | {
      type: 'permission.requested'
      provider: ProviderId
      sessionId?: string
      approvalId: string
      origin: PermissionOrigin
      action: PermissionAction
    }
  | {
      type: 'permission.resolved'
      provider: ProviderId
      sessionId?: string
      approvalId: string
      resolution: ApprovalResolution
    }

// AskUserQuestion (백엔드 중립) — SDK 입력 스키마(docs/agent-sdk/user-input)를 그대로 반영.
// 한 호출에 1~4 질문, 각 질문 2~4 옵션. 미리보기(previewFormat)는 v1 미지원.
export interface AskQuestionOption {
  label: string
  description: string
}

export interface AskQuestion {
  // 표시할 전체 질문 텍스트 (응답 answers 의 key 가 된다).
  question: string
  // 짧은 라벨 (≤12자).
  header: string
  options: AskQuestionOption[]
  // true 면 사용자가 여러 옵션을 선택할 수 있다.
  multiSelect: boolean
}

// canUseTool → renderer 로 가는 질문 묶음. requestId 로 응답을 라우팅한다.
export interface AskQuestionRequest {
  requestId: string
  questions: AskQuestion[]
}

// AskUserQuestion 의 답변 중립 표현 (어댑터/router 내부 도메인 타입). answers 는 질문↔선택의
// 맵, response 는 자유회신. renderer→main 와이어는 단일 PermissionRespond(resolution.allow.
// updatedInput 에 {answers, response} 동봉)로 통일됐다 — 이 타입은 그 updatedInput 의 형태다.
export type AskResult =
  | { type: 'answered'; answers: Record<string, string | string[]>; response?: string }
  | { type: 'skipped' }

// plan 모드 계획 검토 (백엔드 중립). 어댑터가 자기 plan-승인 메커니즘(claude-code 는
// ExitPlanMode/canUseTool)에서 이 형태로 매핑한다 — 렌더러·IPC·reducer 는 SDK 를 모른다.
export interface PlanReviewRequest {
  requestId: string
  // 에이전트가 제출한 계획 (마크다운). 렌더러가 카드로 렌더.
  plan: string
}

// 계획 검토의 중립 결과 (어댑터/router 내부 도메인 타입). approved=실행 / rejected=중단
// (재제안 금지) / revise=피드백 반영해 재작성. renderer→main 와이어는 PermissionRespond 로
// 통일됐다 — approved↔allow, revise↔deny{message}, rejected↔deny{interrupt:true} 로 매핑.
export type PlanDecision =
  | { type: 'approved' }
  | { type: 'rejected' }
  | { type: 'revise'; feedback: string }

// IPC payloads (TRD §5.2 의 활성 부분)
export interface SendChatMessage {
  sessionId: string | null
  // 새 채팅 첫 메시지의 소속 프로젝트. resume(sessionId != null) 의 경우는 무시되고,
  // main 이 sessionId → project_id → instructions 를 DB 에서 직접 조회한다.
  projectId: string | null
  text: string
  // 이 턴에 적용할 권한 모드 (정규화 6종 — Composer 모드 버튼). 부재 시 main 이 기본값(plan) 적용.
  permissionMode?: NormalizedPermissionMode
}

// Composer 권한 모드 버튼이 노출하는 두 모드. SDK PermissionMode 의 부분집합 —
// 'plan'(읽기 전용·계획) / 'acceptEdits'(파일 편집 자동 수락).
//
// 정규화 어휘와의 관계: 앱 내부 SSOT 는 `NormalizedPermissionMode`(6종, src/shared/permission-mode.ts)
// 이고 이 2종은 그 부분집합이다(`plan`↔'plan', `acceptEdits`↔'accept_edits'). 6종 전체 UI 노출과
// 라이브 전환은 PR③ 에서. 브리지: `fromUiPermissionMode()` (permission-mode.ts).
export type PermissionMode = 'plan' | 'acceptEdits'

export interface CancelChat {
  sessionId: string
}

// 권한 모드 라이브 전환 요청 (orca:permission:setMode). 정규화 6종을 그대로 싣는다 —
// main 이 toClaudePermissionMode 로 SDK 모드로 변환해 라이브/다음-턴에 적용.
export interface SetPermissionMode {
  sessionId: string
  mode: NormalizedPermissionMode
}

// ── Capability(능력 탐지) — provider-runtime.md §4/§5 ──────────────────────────────
// ※ 어휘 주의: 여기의 "capability"(능력 탐지, 백엔드→앱, 세션 중)는 extensions/ 의
//   "Extension"(주입 묶음, 앱→백엔드, 세션 전)과 무관한 별개 개념이다 (GLOSSARY §1/§2).
//   백엔드가 *지원하는* 라이프사이클 기능을 서술해, UI 가 false 인 액션을 사전 게이팅한다.
// 순수 데이터 DTO 라 IPC 경계를 넘는다(BackendListResult). main 의 능력-탐지 추상화
// (CapabilityProbe)는 src/main/capabilities/types.ts 가 이 타입들을 재노출하며 정의한다.

// 백엔드가 지원하는 세션 라이프사이클 기능 (provider-runtime.md §4 정본).
export interface SessionCapabilities {
  // lifecycle
  continue?: boolean
  resume?: boolean
  fork?: boolean
  persistSessionFalse?: boolean
  delete?: boolean
  update?: boolean
  // structure / control
  children?: boolean
  summarize?: boolean
  abort?: boolean
  share?: boolean
  init?: boolean
  // 세션 중 권한 모드 라이브 전환 지원 (Claude: Query.setPermissionMode, 스트리밍 입력 모드 전용).
  // PR② 는 선언만 — 값(CLAUDE_DESCRIPTOR set)과 UI 게이팅은 PR③(스트리밍 입력 전환)에서 활성.
  liveModeSwitch?: boolean
  // context
  contextInjectionNoReply?: boolean
  structuredOutput?: boolean
  // revert (§5) — conversation 측. file 측은 RevertCapabilities 가 별도 보유.
  conversationRevert?: boolean
  conversationUnrevert?: boolean
  fileCheckpointCreate?: boolean
  fileCheckpointRestore?: boolean
}

// 되돌리기 능력 (provider-runtime.md §5 정본). **conversation revert ≠ file revert — 절대 병합 금지.**
// 대화/메시지 상태 되돌리기와 파일 변경 snapshot/복원은 별개 개념·별개 capability.
export interface RevertCapabilities {
  conversationRevert: boolean
  conversationUnrevert: boolean
  fileCheckpointCreate: boolean
  fileCheckpointRestore: boolean
}

// 취소 능력 (provider-runtime.md §5 정본).
export interface CancellationCapability {
  sessionAbort?: boolean // OpenCode: session.abort / Claude: AbortController
  denyInterrupt?: boolean // Claude: PermissionResultDeny.interrupt
  abortSignal?: boolean // Claude: ToolPermissionContext.signal
}

// 한 provider 의 능력 서술자 묶음. CapabilityProbe.discover() 의 산출물이며,
// BackendListResult 로 렌더러에 computed-on-the-fly 전달된다(영속 안 함).
export interface ProviderDescriptor {
  provider: ProviderId
  session: SessionCapabilities
  revert: RevertCapabilities
  cancellation: CancellationCapability
}

export interface BackendListResult {
  // capabilities = 해당 백엔드의 능력 서술자(없으면 미탐지). optional 이라 비파괴 확장.
  backends: {
    id: Backend
    installed: boolean
    version?: string
    capabilities?: ProviderDescriptor
  }[]
  active?: Backend
}

export interface StartInstall {
  backend: Backend
}

export interface InstallStatus {
  step: string
  progress?: number
  log?: string
  error?: string
  done?: boolean
}

// Settings (TRD §6.7 / §10 anchor "재시작 재개"). Phase 2+ 영속화 도입.
export type ThemePref = 'classic' | 'dark' | 'cool'
export type DensityPref = 'compact' | 'normal' | 'comfortable'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Settings {
  theme: ThemePref
  density: DensityPref
  sidebarCollapsed: boolean
  sidebarWidth: number
  lastBackend: Backend | null
  lastSessionId: string | null
  windowBounds: WindowBounds | null
  // MCP 서버 enabled on/off (키 = 서버 name). 부재 ⇒ enabled=true.
  mcpEnabled: Record<string, boolean>
  // MCP 서버 Orca 전용 메타(description) — mcp.json(순정 Claude 스키마) 에 없는 필드.
  mcpMeta: Record<string, { description: string }>
}

export type SettingsPatch = Partial<Settings>

// 스킬 카탈로그 — main 이 ~/.claude/skills/ 와 <cwd>/.claude/skills/ 의 SKILL.md
// frontmatter 를 부팅 시 스캔한 결과. 슬래시 명령 자동완성 UI 용.
export interface SkillInfo {
  name: string
  description: string
  argumentHint?: string
}

// `@` 파일 경로 자동완성 — `cwd` 기준 `relDir` 의 직속 항목 한 단계만 리스팅.
export interface ListFilesRequest {
  cwd: string
  relDir: string
}

export interface FileEntry {
  name: string
  isDirectory: boolean
}

// 세션 카탈로그 (사이드바 "최근 대화") — Phase 3 로컬 DB SSOT.
export interface SessionListItem {
  id: string
  backend: Backend
  title: string | null
  updatedAt: number
  preview: string | null
  projectId: string | null
}

export interface LoadSessionRequest {
  sessionId: string
}

export interface DeleteSessionRequest {
  sessionId: string
}

export interface RenameSessionRequest {
  sessionId: string
  title: string
}

// 정규화 메시지 파트(provider-runtime.md §7) — persistence·wire·reducer 공통 SSOT.
// claude 가 실제로 채우는 종류: text / reasoning / tool_call / tool_result / error.
// file / diff / structured_output 은 모델 정의만 두고 OpenCode 어댑터 도입 시 채운다(seam).
export type AppMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; signature?: string }
  | { type: 'tool_call'; toolRunId: string; toolName: string; args: unknown }
  | {
      type: 'tool_result'
      toolRunId: string
      result: unknown
      isError: boolean
      durationMs?: number
    }
  | { type: 'file'; path: string; readType?: 'raw' | 'patch'; content?: string }
  | { type: 'diff'; patch: string }
  | { type: 'structured_output'; value: unknown }
  | { type: 'error'; error: unknown }

// 로드된 세션 — Renderer 의 chatReducer state 와 1:1 대응. 메시지는 순서 보존 parts 로 표현.
export interface LoadedMessage {
  role: 'user' | 'assistant'
  parts: AppMessagePart[]
  createdAt: number
}

export interface LoadedSession {
  id: string
  backend: Backend
  title: string | null
  messages: LoadedMessage[]
}

// 프로젝트 (Phase 3+) — 대화 묶음 + 전용 시스템 프롬프트 (instructions).
export interface Project {
  id: string
  name: string
  instructions: string
  createdAt: number
  updatedAt: number
}

export interface CreateProjectRequest {
  name: string
  instructions: string
}

export interface UpdateProjectRequest {
  id: string
  name?: string
  instructions?: string
}

export interface DeleteProjectRequest {
  id: string
}

export interface ListProjectSessionsRequest {
  projectId: string
}

// 대화 검색 (Phase 3++ Header 검색 모달) — FTS5 백엔드.
export interface SearchMessagesRequest {
  q: string
  limit?: number
}

export interface SearchHit {
  messageId: number
  sessionId: string
  sessionTitle: string | null
  role: 'user' | 'assistant'
  createdAt: number
  // SQLite snippet() 가 생성한 `<mark>…</mark>` 포함 발췌. 렌더러는 split-parse 후
  // React 노드로 재구성 (innerHTML 사용 금지 — XSS 방어).
  snippet: string
}

// MCP 서버 설정 (전역) — claude-agent-sdk query 의 mcpServers / allowedTools 로 주입.
// stdio: 로컬 프로세스 (command + args). http: streamable HTTP 엔드포인트 (url).
export type McpTransport = 'stdio' | 'http'

// renderer 로 노출되는 DTO. 인증 비밀(authEnc)은 절대 포함하지 않고 보유 여부(hasAuth)만 전달.
export interface McpServer {
  id: string
  name: string
  description: string
  transport: McpTransport
  enabled: boolean
  // stdio
  command: string | null
  args: string[]
  // 인증값을 주입할 환경변수 이름 (stdio 전용, 비밀 아님)
  authEnvKey: string | null
  // http
  url: string | null
  // 인증 비밀 보유 여부 (raw 값은 main 만 safeStorage 복호화로 접근)
  hasAuth: boolean
}

// 생성/수정 요청 — 비밀값(auth)은 평문으로 전달되며 main 이 safeStorage 로 암호화 저장.
// auth 가 undefined 면 비밀 미변경(수정 시 기존 유지), 빈 문자열이면 비밀 제거.
export interface CreateMcpServerRequest {
  name: string
  description: string
  transport: McpTransport
  enabled: boolean
  command?: string
  args?: string[]
  authEnvKey?: string
  url?: string
  auth?: string
}

export interface UpdateMcpServerRequest {
  id: string
  name?: string
  description?: string
  transport?: McpTransport
  enabled?: boolean
  command?: string
  args?: string[]
  authEnvKey?: string
  url?: string
  auth?: string
}

export interface DeleteMcpServerRequest {
  id: string
}

// Python 런타임 (uv 기반 격리 인터프리터) 상태.
// 초기화 단계: idle(미시작) → preparing(진행 중) → ready(준비됨) | error(실패).
export type RuntimeStage = 'idle' | 'preparing' | 'ready' | 'error'

export interface RuntimeStatus {
  stage: RuntimeStage
  ready: boolean
  // 진행 단계 라벨 또는 자식 프로세스 stdout/stderr 누적 청크.
  log?: string
  // stage === 'error' 일 때만.
  error?: string
}
