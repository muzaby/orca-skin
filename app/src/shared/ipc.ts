// IPC 채널 이름 + 순수 TS 타입. zod 의존 없음 — preload (sandbox=true) 와 renderer 모두 안전하게 import.
// main 프로세스의 런타임 검증 (zod 스키마) 은 ./protocol.ts 에 별도로 둔다.

// 권한 모드 정규화 타입 (type-only — 런타임 사이클 없음). permission-mode.ts 와 상호 type import.
import type { NormalizedPermissionMode } from './permission-mode'

// Phase 2 활성 채널 (preload 노출 대상). 미사용 채널은 의도적으로 누락.
export const CHANNELS = {
  chatSend: 'orca:chat:send',
  chatSteer: 'orca:chat:steer',
  chatSteerCancel: 'orca:chat:steerCancel',
  chatEvent: 'orca:chat:event',
  chatCancel: 'orca:chat:cancel',
  chatStopSubagent: 'orca:chat:stopSubagent',
  backendList: 'orca:backend:list',
  agentList: 'orca:agent:list',
  installStart: 'orca:install:start',
  installStatus: 'orca:install:status',
  settingsGet: 'orca:settings:get',
  settingsSet: 'orca:settings:set',
  skillsList: 'orca:skills:list',
  skillsAuthor: 'orca:skills:author',
  skillsUpload: 'orca:skills:upload',
  skillsSetEnabled: 'orca:skills:setEnabled',
  skillsOpen: 'orca:skills:open',
  skillsShowInFolder: 'orca:skills:showInFolder',
  skillsRemove: 'orca:skills:remove',
  filesList: 'orca:files:list',
  filesPickAttachments: 'orca:files:pickAttachments',
  filesPickDirectory: 'orca:files:pickDirectory',
  filesOpenPath: 'orca:files:openPath',
  filesReadAttachment: 'orca:files:readAttachment',
  sessionCwd: 'orca:session:cwd',
  sessionList: 'orca:session:list',
  sessionLoad: 'orca:session:load',
  sessionDelete: 'orca:session:delete',
  sessionRename: 'orca:session:rename',
  sessionTitleEvent: 'orca:session:titleEvent',
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
  costSummary: 'orca:cost:summary',
  costSummaryEvent: 'orca:cost:summaryEvent',
  concurrencyEvent: 'orca:concurrency:event',
  // 권한 응답 단일 채널 — ask/plan/tool 세 종류의 승인 응답이 모두 이 채널로 흐른다
  // (askRespond/planRespond 2채널 통합). 응답 = { approvalId, resolution: ApprovalResolution }.
  permissionRespond: 'orca:permission:respond',
  // 세션 진행 중 권한 모드 라이브 전환 (PR③). { sessionId, mode } 를 main 에 invoke —
  // 진행 중 턴이면 즉시 Query.setPermissionMode, 아니면 controller 에 기록해 다음 턴에 반영.
  permissionSetMode: 'orca:permission:setMode',
  debugGetMock: 'orca:debug:getMock',
  debugSetMock: 'orca:debug:setMock',
  engineAdd: 'orca:engine:add',
  engineUpdate: 'orca:engine:update',
  engineDelete: 'orca:engine:delete',
  engineRead: 'orca:engine:read'
} as const

// dev 전용 MockAdapter 시나리오. ProviderId/Backend 에 mock 을 추가하지 않고 claude 로
// 위장해 실제 라우터·영속화·renderer reducer 경로를 그대로 검증한다.
export const MOCK_SCENARIO_IDS = [
  'text_streaming',
  'reasoning',
  'tool_calls',
  'tool_approval',
  'ask_question',
  'plan_review',
  'subagent_task',
  'subagent_task_child',
  'subagent_task_aborted',
  'subagent_task_multi',
  'subagent_task_running',
  'error',
  'full'
] as const

export type MockScenarioId = (typeof MOCK_SCENARIO_IDS)[number]

export interface DebugMockState {
  enabled: boolean
  scenarioId: MockScenarioId
  contextUsageRatio: number
  // dev 전용 — main 의 outbound wire message(NormalizedEvent) 를 터미널에 덤프할지.
  wireLog: boolean
}

export interface CostPeriodSummary {
  totalCostUsd: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}

export interface CostSummary {
  day: CostPeriodSummary
  week: CostPeriodSummary
  month: CostPeriodSummary
  updatedAt: number
}

export interface SessionTitleEvent {
  sessionId: string
  title: string
}

// Backend (Phase 2: claude 단일. opencode 는 future work)
export type Backend = 'claude'

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface AgentModelView {
  alias: string
  model: string | null
  isCustom: boolean
  oneMillionContext: boolean
  isDefault: boolean
}

export interface AgentEnvironment {
  key: string
  adapter: string
  provider?: string
  models: AgentModelView[]
  supported: boolean
}

export interface CreateEngineRequest {
  engine: 'claude'
  provider: string
  settingsJson: string
}

export interface UpdateEngineRequest {
  key: string
  settingsJson: string
}

export interface DeleteEngineRequest {
  key: string
}

export interface ReadEngineRequest {
  key: string
}

export interface EngineReadResult {
  key: string
  engine: 'claude'
  provider: string
  settingsJson: string
}

export interface EngineWriteResult {
  key: string
  engine: 'claude'
  provider: string
}

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
// 인스턴스/함수 금지(반드시 sanitizeCause 로 평탄화). provider 는 optional(표시용) — 어댑터
// 컨텍스트가 있을 때만 채우고, 세션-이전 오케스트레이션 에러(스키마 검증·활성 백엔드 없음)는 부재(0016).
export interface ClassifiedError {
  category: ErrorCategory
  message: string
  retryable: boolean
  provider?: ProviderId
  cause?: unknown
}

// ── NormalizedEvent (provider-runtime.md §2) — 와이어(orca:chat:event)의 정규 이벤트 ─────────
// 이벤트는 sessionId(멀티세션 라우팅)로 키잉되고 tool 은 toolRunId 로 start/complete 를 매칭한다.
// 코어 중립(0016): 이벤트는 provider 를 싣지 않는다 — "어느 백엔드인지" 는 session.backend 파생.
// claude 어댑터는 SDK 메시지를 claudeToNormalized(adapters/claude-map.ts)로 이 타입에 직접
// 정규화한다. OpenCode 도 같은 union 으로 정규화(seam, provider 무관).
// 권한 요청은 permission.requested 1급 이벤트(origin 으로 agent/app 구분, action.kind 로 종류 구분).
export type ProviderId = 'claude' | 'opencode'

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

// 계획 검토(plan_review) revise 시 사용자가 본문에 남긴 인라인 코멘트 1건. quote=대상 본문
// 스냅샷(직렬화·표시용), start/end=계획 본문 textContent 기준 오프셋(문서 순서 정렬용).
export interface PlanFeedbackComment {
  id: string
  quote: string
  start: number
  end: number
  body: string
}

// plan revise 의 구조화 피드백 — 코멘트 묶음 + 선택 메모(자유 입력). main 이 구조화 태그
// (ORCA_PLAN_FEEDBACK)로 직렬화해 ExitPlanMode deny message 로 전달한다(prompts/plan-feedback.ts).
export interface PlanFeedback {
  comments: PlanFeedbackComment[]
  note?: string
}

// 권한 해소의 2분기(4값 모델 폐기 — provider-runtime.md §3). claude PermissionResult 와 동형:
// allow{updatedInput?} ↔ behavior:'allow', deny{message?,interrupt?} ↔ behavior:'deny'.
// deny.planFeedback: 계획 revise 의 구조화 코멘트(있으면 main 이 message 대신 태그 직렬화).
export type ApprovalResolution =
  | { behavior: 'allow'; updatedInput?: unknown; updatedPermissions?: PermissionUpdate[] }
  | { behavior: 'deny'; message?: string; interrupt?: boolean; planFeedback?: PlanFeedback }

// renderer → main 단일 권한 응답 (permissionRespond 채널). approvalId 로 보류 중인
// 승인(InteractionBroker)을 라우팅하고, resolution 으로 해소한다.
export interface PermissionRespond {
  approvalId: string
  resolution: ApprovalResolution
}

// provider 가 턴 종료 시 보고하는 사용량/비용 통계 (provider-runtime.md §8 ProviderReportedTelemetry).
// 전 필드 optional — 런타임이 일부만 주거나 안 줄 수 있다(graceful). claude `result` 의 snake_case·
// camelCase 혼용 필드를 camelCase 로 정규화한다. cost 는 추정값(cost-tracking.md §14 — 청구 권위 아님).
export interface TelemetryModelUsage {
  costUsd?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

export interface ProviderReportedTelemetry {
  model?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  costUsd?: number
  durationMs?: number
  numTurns?: number
  modelUsage?: Record<string, TelemetryModelUsage>
}

// 코어 중립(handoff 0016): NormalizedEvent 는 "어느 백엔드에서 왔는지" 를 더 이상 싣지 않는다.
// provider 는 어떤 소비자도 읽지 않는 write-only 메타였고 session.backend(0010 세션-어댑터
// 잠금)와 중복된 이중 진실원이었다. "어느 백엔드인지" 는 sessionId → session.backend 로 파생한다.
export type NormalizedEvent =
  | {
      type: 'session.updated'
      sessionId: string
      patch: { model?: string; cwd?: string }
    }
  | { type: 'message.delta'; sessionId: string; delta: { text: string } }
  | { type: 'steer.queued'; sessionId: string; id: string; text: string; createdAt: number }
  | {
      type: 'steer.flushed'
      sessionId: string
      ids: string[]
      text: string
      messageId: number
      createdAt: number
    }
  | { type: 'steer.cancelled'; sessionId: string; id: string }
  // 커밋된 user 메시지 에코(0062) — main 이 본문을 조립해 렌더러가 내용을 모르는 발화
  // (handoff /compact 자동 메시지)에만 발행한다. 일반 send 의 user 버블은 렌더러 낙관 렌더.
  | { type: 'message.user'; sessionId: string; text: string; createdAt: number }
  // SDK 네이티브 압축 완료(system/compact_boundary → 정규화, 0062). 도착 세션 transcript 에
  // 압축 경계를 표시한다. preTokens = 압축 전 토큰 수(compact_metadata.pre_tokens).
  | {
      type: 'session.compacted'
      sessionId: string
      trigger?: 'manual' | 'auto'
      preTokens?: number
    }
  | {
      type: 'message.completed'
      sessionId: string
      message: { text: string }
      // 서브에이전트(Task) 안에서 발생한 텍스트면 부모 Task 의 toolRunId. 최상위 턴이면 생략.
      parentToolRunId?: string
    }
  // 확장사고(extended thinking) 블록 — provider-runtime.md §7 reasoning part 의 출처.
  // signature 는 멀티턴 재전송 무결성용 opaque 값(해석 금지, 원형 보관).
  | {
      type: 'message.reasoning'
      sessionId: string
      text: string
      signature?: string
    }
  // 확장사고 라이브 델타(transient — message.delta 와 동형, DB 미저장). 영속은 완성 블록의
  // message.reasoning 이 담당. 런타임이 thinking_delta 를 안 흘리면 발생 안 함(graceful).
  | {
      type: 'message.reasoning.delta'
      sessionId: string
      delta: { text: string }
    }
  | {
      type: 'tool.call.started'
      sessionId: string
      toolRunId: string
      toolName: string
      args: unknown
      parentToolRunId?: string
    }
  | {
      type: 'tool.call.completed'
      sessionId: string
      toolRunId: string
      result: unknown
      isError: boolean
      durationMs?: number
      parentToolRunId?: string
      // 부모 Task(서브에이전트) tool_result 면 SDK task_* 누산 메타(모델·시간·도구수)를 실어
      // 영속한다 — 세션 재로드 후에도 카드/행이 모델·소요시간을 복원하게 한다.
      subagentMeta?: SubagentTaskMeta
    }
  // 서브에이전트(Task) 라이브 메타 — SDK task_started/task_progress/task_notification 정규화.
  // reducer 미경유(메인 transcript 파트 비오염): store 가 toolUseId 키 transient 맵으로 흡수해
  // 우측 패널·AgentTaskRow 의 모델/경과시간/현재도구/도구수 표시를 구동한다.
  | {
      type: 'subagent.task'
      sessionId: string
      // 부모 Agent(Task) 도구 호출 id (= child 들의 parentToolRunId). 표시·중단 키.
      toolUseId: string
      phase: 'started' | 'progress' | 'settled'
      // SDK task_id — stopTask(taskId) 대상. started/progress/settled 에서 실린다.
      taskId?: string
      subagentType?: string
      description?: string
      // child assistant 메시지의 실제 모델 id(message.model). 'Explore'(subagent_type) 가 아님.
      model?: string
      durationMs?: number
      toolUses?: number
      lastToolName?: string
      status?: 'completed' | 'failed' | 'stopped'
      summary?: string
    }
  | {
      type: 'telemetry'
      sessionId: string
      usage?: ProviderReportedTelemetry
    }
  | {
      type: 'error'
      sessionId?: string
      error: ClassifiedError
    }
  | {
      type: 'turn.retrying'
      sessionId?: string
      attempt: number
      maxRetries: number
      error: ClassifiedError
    }
  | {
      type: 'turn.aborted'
      sessionId?: string
      reason: 'user_cancelled' | 'timeout'
    }
  // 권한 요청/해소 1급 이벤트 — AskUserQuestion·ExitPlanMode·일반 도구 게이트를 단일 경로로 통합.
  // approvalId 로 요청↔응답을 라우팅한다(renderer 는 이 id 로 permissionRespond 회신).
  | {
      type: 'permission.requested'
      sessionId?: string
      approvalId: string
      origin: PermissionOrigin
      action: PermissionAction
    }
  | {
      type: 'permission.resolved'
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

// plan 모드 계획 검토 (백엔드 중립). 어댑터가 자기 plan-승인 메커니즘(claude 는
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

export type AttachmentSourceKind = 'dialog' | 'drag_drop' | 'clipboard'

export type ComposerAttachment =
  | {
      kind: 'path'
      path: string
      name: string
      mimeType: string
      sizeBytes?: number
      sourceKind: AttachmentSourceKind
    }
  | {
      kind: 'inline'
      data: string
      name: string
      mimeType: string
      sizeBytes?: number
      sourceKind: AttachmentSourceKind
    }

export interface PickedAttachment {
  path: string
  name: string
  mimeType: string
  sizeBytes: number
  sourceKind: AttachmentSourceKind
}

// 트랜스크립트 user 버블/영속용 첨부 뷰 — 모델 주입용 ComposerAttachment(경로/바이트)와 별개로
// 렌더·DB 에 남길 가벼운 메타다. 이미지는 previewDataUrl 에 다운스케일 썸네일(data URL)을 담아
// reload 후에도 보이게 하고(원본 base64/경로 미보관), 비-이미지는 확장자만 칩으로 표시한다.
export interface AttachmentView {
  id: string
  name: string
  mimeType: string
  kind: 'image' | 'file'
  previewDataUrl?: string
  sizeBytes?: number
}

export interface ReadAttachmentRequest {
  path: string
}

export interface ReadAttachmentResult {
  data: string
  mimeType: string
}

export interface ConcurrencyEvent {
  projectId: string
  count: number
}

// IPC payloads (TRD §5.2 의 활성 부분)
export interface SendChatMessage {
  sessionId: string | null
  // 새 채팅 첫 메시지의 소속 프로젝트. resume(sessionId != null) 의 경우는 무시되고,
  // main 이 sessionId → project_id → instructions 를 DB 에서 직접 조회한다.
  projectId: string | null
  text: string
  // 이 턴에 적용할 권한 모드 (정규화 6종 — Composer 모드 버튼). 부재 시 main 이 기본값(plan) 적용.
  permissionMode?: NormalizedPermissionMode
  // 이 턴에 적용할 agent/provider 와 모델 family. 둘 다 optional 이라 기존 payload 호환.
  providerKey?: string | null
  modelFamily?: string | null
  // 이 턴에 적용할 Claude Code thinking effort. per-turn 전송만 지원한다.
  effort?: EffortLevel
  attachments?: ComposerAttachment[]
  // 영속·렌더 전용 첨부 뷰(다운스케일 썸네일 포함). attachments 가 모델 주입용이라면 이쪽은
  // user 메시지에 attachment 파트로 남겨 트랜스크립트에 보이게 한다.
  attachmentViews?: AttachmentView[]
  // 새 세션 출생 시 고정할 작업 디렉토리. sessionId != null resume 턴에서는 main 이 DB cwd 를 우선한다.
  cwd?: string | null
  // 0062 continuity — fork/handoff 물질화 트리거. 새 세션 send(sessionId=null)에서만 유효하며
  // 상호 배타. main 은 출발 세션의 cwd/project/provider 를 계승하고 SDK forkSession 으로
  // 새 session_id 를 발급받는다. forkFrom = 분기(도착 세션에 display 복사 + lineage 'fork').
  // handoffFrom = 핸드오프(main 이 text 를 /compact 자동 메시지로 대체 + lineage 'handoff' —
  // text 는 생략 가능, display 복사 없음).
  forkFrom?: string
  handoffFrom?: string
}

// Composer 권한 모드 버튼이 노출하는 두 모드. SDK PermissionMode 의 부분집합 —
// 'plan'(읽기 전용·계획) / 'acceptEdits'(파일 편집 자동 수락).
//
// 정규화 어휘와의 관계: 앱 내부 SSOT 는 `NormalizedPermissionMode`(6종, src/shared/permission-mode.ts)
// 이고 이 2종은 그 부분집합이다(`plan`↔'plan', `acceptEdits`↔'accept_edits'). 6종 전체 UI 노출과
// 라이브 전환은 PR③ 에서. 브리지: `fromUiPermissionMode()` (permission-mode.ts).
export type PermissionMode = 'plan' | 'acceptEdits'

export interface SteerChatMessage {
  sessionId: string
  text: string
  clientRequestId?: string
}

export interface CancelSteer {
  sessionId: string
  id: string
}

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
export type ThemePref = 'white' | 'dark'
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
  // Skill enabled on/off (키 = sourceId/name). 부재 ⇒ enabled=true.
  skillEnabled: Record<string, boolean>
}

export type SettingsPatch = Partial<Settings>

// 스킬 카탈로그 — main 이 ~/.claude/skills/ 와 <cwd>/.claude/skills/ 의 SKILL.md
// frontmatter 를 부팅 시 스캔한 결과. 슬래시 명령 자동완성 UI 용.
export interface SkillInfo {
  name: string
  description: string
  argumentHint?: string
  sourceId: string
  sourceLabel: string
  enabled: boolean
  body?: string
  updatedAt?: number
  createdAt?: number
  sourceKind: 'orca' | 'adapter' | 'workspace'
  canToggle: boolean
  canRemove: boolean
  skillPath: string
  skillDir: string
}

export interface AuthorSkillRequest {
  name: string
  description: string
  body: string
}

export interface UploadSkillRequest {
  fileName: string
  content: string
}

export interface SetSkillEnabledRequest {
  name: string
  sourceId: string
  enabled: boolean
}

export interface SkillTargetRequest {
  name: string
  sourceId: string
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

export interface OpenPathRequest {
  path: string
}

// 세션 카탈로그 (사이드바 "최근 대화") — Phase 3 로컬 DB SSOT.
export interface SessionListItem {
  id: string
  backend: Backend
  title: string | null
  updatedAt: number
  preview: string | null
  projectId: string | null
  cwd: string | null
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

// 서브에이전트(Task) 영속 메타 — 부모 Task tool_result 에 실려 세션 재로드 후에도 모델·소요시간·
// 도구수를 복원한다. 라이브(진행 중) 표시는 store transient 가, 영속/재로드는 이 필드가 담당.
export interface SubagentTaskMeta {
  model?: string
  durationMs?: number
  toolUses?: number
}

// 정규화 메시지 파트(provider-runtime.md §7) — persistence·wire·reducer 공통 SSOT.
// claude 가 실제로 채우는 종류: text / reasoning / tool_call / tool_result / error.
// file / diff / structured_output 은 모델 정의만 두고 OpenCode 어댑터 도입 시 채운다(seam).
export type AppMessagePart =
  // parentToolRunId: 서브에이전트(Task) child 의 텍스트/사고면 부모 Task toolRunId. 최상위면 생략.
  // 메인 트랜스크립트는 이 필드가 있는 파트를 제외하고, 우측 패널 child 트랜스크립트만 모은다.
  | { type: 'text'; text: string; parentToolRunId?: string }
  | { type: 'reasoning'; text: string; signature?: string; parentToolRunId?: string }
  | {
      type: 'tool_call'
      toolRunId: string
      toolName: string
      args: unknown
      parentToolRunId?: string
    }
  | {
      type: 'tool_result'
      toolRunId: string
      result: unknown
      isError: boolean
      durationMs?: number
      parentToolRunId?: string
      // 부모 Task tool_result 면 서브에이전트 영속 메타(모델·시간·도구수).
      subagentMeta?: SubagentTaskMeta
    }
  | { type: 'file'; path: string; readType?: 'raw' | 'patch'; content?: string }
  | { type: 'diff'; patch: string }
  | { type: 'structured_output'; value: unknown }
  | { type: 'error'; error: unknown }
  // 컴포저 첨부(user 턴) — 트랜스크립트 버블에 썸네일로 렌더하고 DB 에 영속한다.
  | { type: 'attachment'; attachments: AttachmentView[] }
  // 압축 경계 마커(0062 handoff) — session.compacted 를 영속해 재로드 후에도 경계를 표시한다.
  | { type: 'compact_boundary'; trigger?: 'manual' | 'auto'; preTokens?: number }

// 로드된 세션 — Renderer 의 chatReducer state 와 1:1 대응. 메시지는 순서 보존 parts 로 표현.
export interface LoadedMessage {
  role: 'user' | 'assistant'
  parts: AppMessagePart[]
  createdAt: number
  incomplete?: boolean
}

export interface LoadedSession {
  id: string
  backend: Backend
  title: string | null
  messages: LoadedMessage[]
  // 세션 마지막 턴의 provider-reported 통계 — 컨텍스트 도넛/TelemetryPanel 을 세션 수명 동안
  // 복원(turn_usage 최신 행에서 재구성). 비용 집계는 원장 SUM 으로 별도(추후 usage 화면).
  lastTelemetry?: ProviderReportedTelemetry
  // sessions.provider_key — 마지막 사용 provider 기록. null 은 레거시/미매칭 fallback.
  providerKey?: string | null
  projectId?: string | null
  cwd?: string | null
  // 0062 continuity — 이 세션이 fork/handoff 로 파생된 경우의 부모 관계(session_lineage).
  // 렌더러가 출처 배너("원본 열기" 링크)를 복원하는 데 쓴다. parentTitle 은 표시용 스냅샷.
  lineage?: { parentSessionId: string; relation: 'fork' | 'handoff'; parentTitle: string | null }
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

// (구 RuntimeStage/RuntimeStatus 와 runtime IPC 채널은 제거됨 — 와이어 타입이 아니다.)
