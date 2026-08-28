// IPC 채널 이름 + 순수 TS 타입. zod 의존 없음 — preload (sandbox=true) 와 renderer 모두 안전하게 import.
// main 프로세스의 런타임 검증 (zod 스키마) 은 ./protocol.ts 에 별도로 둔다.

// 권한 모드 정규화 타입 (type-only — 런타임 사이클 없음). permission-mode.ts 와 상호 type import.
import type { NormalizedPermissionMode } from './permission-mode'
// continuity 언어 스냅샷(0127) — type-only.
import type { ContinuityLang } from './continuity-lang'

// Phase 2 활성 채널 (preload 노출 대상). 미사용 채널은 의도적으로 누락.
export const CHANNELS = {
  chatSend: 'orca:chat:send',
  // 0067 AC5: 구 chat:steer 는 chat:send 로 흡수(main 이 busy=예약/idle=즉시를 판정).
  chatSteerCancel: 'orca:chat:steerCancel',
  chatEvent: 'orca:chat:event',
  chatCancel: 'orca:chat:cancel',
  chatStopSubagent: 'orca:chat:stopSubagent',
  // 세션 전체 중단(0151 r2) — Stop 이후에도 CLI 큐에 살아남은 우리 예약을 없애는 유일한 수단.
  // 공개 SDK 에 provider 큐 개별 취소가 없으므로 런타임(서브프로세스)을 폐기해 큐를 통째로
  // 소멸시킨다. 백그라운드 서브에이전트도 함께 죽으므로 **사용자가 명시적으로 고를 때만** 쓴다.
  chatDiscardSession: 'orca:chat:discardSession',
  bootReport: 'orca:boot:report',
  // main 부팅 완료 게이트(0109) — 창을 start() 전에 띄우므로, renderer 부트 오케스트레이터의
  // 첫 스텝이 이 invoke 로 main 준비를 기다린 뒤에야 나머지 IPC 스텝을 시작한다.
  bootWhenReady: 'orca:boot:whenReady',
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
  // 컴포저 브랜치 칩(작업 경로의 git 상태·브랜치 목록·전환). 작업 경로가 git 저장소가 아니면
  // status 가 `isRepo:false` 를 돌려주고 renderer 는 칩 자체를 렌더하지 않는다.
  gitStatus: 'orca:git:status',
  gitBranches: 'orca:git:branches',
  gitCheckout: 'orca:git:checkout',
  sessionCwd: 'orca:session:cwd',
  sessionList: 'orca:session:list',
  sessionLoad: 'orca:session:load',
  sessionDelete: 'orca:session:delete',
  sessionRename: 'orca:session:rename',
  sessionSetPinned: 'orca:session:setPinned',
  sessionTitleEvent: 'orca:session:titleEvent',
  projectList: 'orca:project:list',
  projectCreate: 'orca:project:create',
  projectUpdate: 'orca:project:update',
  projectDelete: 'orca:project:delete',
  projectSetPinned: 'orca:project:setPinned',
  projectListSessions: 'orca:project:listSessions',
  windowMinimize: 'orca:window:minimize',
  windowMaximize: 'orca:window:maximize',
  windowClose: 'orca:window:close',
  searchMessages: 'orca:search:messages',
  mcpList: 'orca:mcp:list',
  mcpAdd: 'orca:mcp:add',
  mcpUpdate: 'orca:mcp:update',
  mcpDelete: 'orca:mcp:delete',
  // 사용량 정본 조회 (0186) — providerKey 를 주면 그 provider, 없으면 전역. 구 `cost:summary`
  // 와 `cost:providerSummaries` 를 흡수했다(Main 이 UsageLimitsView 를 완성해 돌려준다).
  costUsage: 'orca:cost:usage',
  // 변경된 scope 만 push 하는 delta (0186). 전체 provider map 을 매번 보내지 않는다.
  costUsageEvent: 'orca:cost:usageEvent',
  // provider별 월 한도 설정 (0080 항목 4).
  costSetProviderLimit: 'orca:cost:setProviderLimit',
  // 원격 사용량 즉시 동기화 (0186) — **쓰기/커맨드**다. 설정 사용량 탭의 동기화 버튼이 1분
  // cron 을 기다리지 않고 지금 원격을 부른다. 읽기 채널 `cost:usage` 에 부수효과 옵션을 넣는
  // 대신 채널을 나눴다 — read query 와 write command 의 구분이 채널 수보다 중요하다.
  costRefreshUsage: 'orca:cost:refreshUsage',
  // 사용량 요약(0112) — 기간(range)별 일 단위 시계열 + 모델별 집계를 한 번에 반환.
  costUsageStats: 'orca:cost:usageStats',
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
  engineRead: 'orca:engine:read',
  // 사용자 전역 ~/.claude/settings.json 원문 조회 — 모달의 settings.json 자동완성용.
  engineImportUserSettings: 'orca:engine:importUserSettings',
  notifyShow: 'orca:notify:show',
  updateState: 'orca:update:state',
  updateCheck: 'orca:update:check',
  updateDownload: 'orca:update:download',
  updateQuitAndInstall: 'orca:update:quitAndInstall',
  updateStateEvent: 'orca:update:stateEvent',
  updateProgressEvent: 'orca:update:progressEvent',
  // renderer/preload → main 로그 인제스트 (0123). 유일한 one-way send 채널 —
  // fire-and-forget 이라 invoke 가 아니다. 공통 필드는 main 이 강제 부여.
  logEmit: 'orca:log:emit',
  // provider 플랫폼 (0181) — 구 auth 7 + plugin 4 채널을 6개로 대체한다. 인증 대상은
  // `Provider` 선언 하나이고, 게이트·LLM·사내 서비스가 `kind` 로만 갈린다.
  providerList: 'orca:provider:list',
  providerLogin: 'orca:provider:login',
  providerContinue: 'orca:provider:continue',
  providerReauth: 'orca:provider:reauth',
  providerRevoke: 'orca:provider:revoke',
  // **양방향 1채널** — invoke 는 게이트 판정용 초기 스냅샷, send 는 이후 변화 push.
  // 같은 객체(`ProviderPlatformState`)를 나르므로 채널을 둘로 쪼개지 않는다(구 auth 는
  // `status`+`stateEvent` 로 나눠 두 벌의 동기화 버그를 만들었다).
  providerState: 'orca:provider:state'
} as const

export type UpdateStateStatus =
  'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'error'
export interface UpdateProgress {
  percent: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
}
export interface UpdateState {
  status: UpdateStateStatus
  currentVersion: string
  availableVersion?: string
  releaseNotes?: string | null
  progress?: UpdateProgress
  canInstall: boolean
  installBlockReason?: string
  error?: string
  lastError?: string
  checkedAt?: number
}
export interface UpdateCheckResult {
  ok: boolean
  state: UpdateState
  reason?: 'feed-not-configured' | 'check-failed' | 'not-available' | 'download-failed'
}
export interface UpdateInstallResult {
  ok: boolean
  reason?: 'not-ready' | 'not-idle' | 'internal-error'
  message?: string
}

export type BootReportStatus = 'ok' | 'warning' | 'failed'

export interface BootReportStep {
  id: string
  label?: string
  status: BootReportStatus
  critical: boolean
  startedAt: number
  finishedAt: number
  durationMs: number
  message?: string
}

export interface BootReport {
  startedAt: number
  finishedAt: number
  durationMs: number
  status: BootReportStatus
  steps: BootReportStep[]
  warnings: string[]
}

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
  // 0204 — 작업 타일 실기 진입점. TaskCreate/TaskUpdate/TaskList 관측과 진행 중 background
  // 작업을 한 세션에서 재현해 CLI 없이 목록·그룹·중단 UI 를 확인한다.
  'agent_task_board',
  'error',
  'full'
] as const

export type MockScenarioId = (typeof MOCK_SCENARIO_IDS)[number]

export interface DebugMockState {
  enabled: boolean
  scenarioId: MockScenarioId
  contextUsageRatio: number
  // dev 전용 "로그" 스위치(0124) — ON 이면 outbound wire message(NormalizedEvent, 델타 제외)를
  // 로거 debug(`ipc.wire.event`)로 기록하고 모든 로그 레코드를 main 콘솔에 미러한다. 비영속.
  log: boolean
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

// 0183 r2 가 `ProviderUsageEntry`(summary + limitUsd) 를 로컬 값 셋으로 줄였고, 0186 이 그것을
// 아예 제거했다 — Main 이 `UsageLimitsView` 를 완성하므로 renderer 가 다시 파생할 중간 형식이
// 필요 없다. 한도 파생은 `shared/usage/limits.ts` 한 곳에서만 일어나고, IPC 로 오가는 사용량
// 타입(`UsageLimitsView`·`UsageDelta`)도 그 파일이 소유한다 — 여기에 두면 `limits.ts` 가
// `CostSummary` 를 가져가므로 순환이 된다(`import/no-cycle`).

// 사용량 요약(0112) — 설정 사용량 탭의 일별 토큰 차트 + 모델별 내역.
// days 는 실제 사용이 있던 날만 담는 희소 배열(오름차순) — 제로필은 renderer 의
// fillDailySeries(shared/usage/stats.ts) 가 수행한다. since=null 은 '전체' 범위.
export type UsageStatsRange = '7d' | '30d' | 'all'

export interface UsageStatsDay {
  day: string // 'YYYY-MM-DD' (OS 로컬 타임존)
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  totalCostUsd: number
}

export interface UsageStatsModel {
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  costUsd: number
}

export interface UsageStats {
  range: UsageStatsRange
  since: number | null
  days: UsageStatsDay[]
  models: UsageStatsModel[] // 총 토큰 내림차순
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
  source?: 'settings' | 'runtime'
  readOnly?: boolean
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

// ~/.claude/settings.json 원문 조회 결과 — 파일 부재/읽기 실패면 exists=false.
// 내용 검증은 하지 않는다(렌더러 실시간 JSON 검증이 담당).
export interface EngineUserSettingsResult {
  exists: boolean
  settingsJson: string
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
  // SDK 가 보고하는 이 모델의 실제 컨텍스트 윈도우(토큰, 0134). 미제공/복원(DB 재조립) 경로엔
  // 없음 — renderer 는 contextWindowOf() 폴백(모델명 휴리스틱)으로 내려간다.
  contextWindow?: number
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
  // 단일 모델 턴이면 model 과 함께 그 모델의 contextWindow 도 top-level 승격(0134).
  contextWindow?: number
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
  // pending message queue 간접 관찰 3종(0067 — 구 steer.* 일반화). 모든 사용자 프롬프트가
  // queued(pending 버블) → committed(echo 커밋, 정식 버블 승격) 로 흐르고, cancelled 는 held
  // 취소(단건 hover / 중단 버튼 전량 — renderer 가 잔존 항목 텍스트를 draft 로 복원).
  // 새 세션 send 는 sessionId 미확정이라 optional — renderer 는 clientKey/pendingNewChatKey 로
  // 라우팅한다.
  | {
      type: 'message.queued'
      sessionId?: string
      id: string
      text: string
      attachmentViews?: AttachmentView[]
      createdAt: number
    }
  // main 내부 커밋 신호(renderer 미전달) — CLI 가 stdin 주입 입력을 흡수해 user 메시지로 echo 한
  // 순간(SDKUserMessageReplay). TurnCoordinator 가 pending 소비 확정에만 쓰고 persist/forward
  // 하지 않는다. uuid = 주입 배치 uuid(미보존 시 text 매칭 폴백, 0060 D1).
  | { type: 'input.echo'; sessionId: string; text: string; uuid?: string }
  | {
      type: 'message.committed'
      sessionId: string
      ids: string[]
      text: string
      attachmentViews?: AttachmentView[]
      messageId: number
      createdAt: number
    }
  | { type: 'message.cancelled'; sessionId: string; ids: string[] }
  // 소유권 전이(0151) — pending 버블이 held(취소 가능) ↔ submitted(stdin 주입 완료, 취소 불가)
  // 사이를 오갈 때 발신한다. `submitted:true` 면 renderer 는 취소 버튼을 감추고 "전달됨" 으로
  // 표시하고, `false`(예약 롤백 — 닫힌 입력 스트림 등)면 다시 취소 가능 상태로 되돌린다.
  // message.queued 동렬의 **미영속 UI 상태 신호**(버스 미경유 — history/usage 미소비).
  | { type: 'message.submitted'; sessionId: string; ids: string[]; submitted: boolean }
  | ChatActivitySnapshot
  // SDK 네이티브 압축 완료(system/compact_boundary → 정규화, 0064). 도착 세션 transcript 에
  // 압축 경계를 표시한다. preTokens/postTokens = 압축 전/후 토큰 수(compact_metadata 의
  // pre_tokens/post_tokens — post 는 SDK optional). postTokens 는 압축 후 컨텍스트 실측이라
  // 구분선 "pre → post" 표기와 도넛 근사(0065 r2)의 1순위 참조다.
  | {
      type: 'session.compacted'
      sessionId: string
      trigger?: 'manual' | 'auto'
      preTokens?: number
      postTokens?: number
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
      // SDK 구조화 도구 출력(tool_use_result) — **TaskXXX 도구에만** 싣는다(0204). `result` 는
      // 모델용 wire content 라 TaskCreate 의 task.id 같은 필드를 담지 않는다. 다른 도구까지
      // 실으면 큰 출력이 그대로 영속되므로 `isTaskToolName` 이 유일한 게이트다.
      structuredOutput?: unknown
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
      // settled 한정(0143) — main 권위 게이팅: async_launched 런치 영수증이 관측된(=실제로
      // 백그라운드로 돈) 태스크의 정착에만 true. renderer 완료 통지(subagent_notice 파트 커밋)와
      // history writer 영속의 유일한 신호 — renderer 는 스스로 background 를 추론하지 않는다.
      background?: boolean
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
  { type: 'approved' } | { type: 'rejected' } | { type: 'revise'; feedback: string }

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
  // 작업 디렉토리 밖의 **추가 참조 경로**(CLI `/add-dir` 대응). 컴포저 참조 경로 칩이 만든다.
  // cwd 와 마찬가지로 새 세션 출생 시 고정되고 세션행에 영속된다 — resume 턴에서는 DB 값이 이긴다.
  // 어댑터에서 `additionalDirectories` + workspace 가드 루트로 함께 흘러 r/w 스코프를 넓힌다.
  extraDirs?: string[]
  // 0064 continuity — fork/handoff 물질화 트리거. 새 세션 send(sessionId=null)에서만 유효하며
  // 상호 배타. main 은 출발 세션의 cwd/project/provider 를 계승하고 SDK forkSession 으로
  // 새 session_id 를 발급받는다. forkFrom = 분기(도착 세션에 display 복사 + lineage 'fork').
  // handoffFrom = 핸드오프(main 이 text 를 /compact 자동 메시지로 대체 + lineage 'handoff' —
  // text 는 생략 가능, display 복사 없음).
  forkFrom?: string
  handoffFrom?: string
  // 0127 — continuity 산출물(제목 마커·핸드오프 자동 메시지) 언어의 draft 생성 시점 스냅샷
  // (settings.language 파생 ko/en 2종 — uiLocale i18n 아님). renderer draft 제목과 main
  // initialTitle 의 문자열 일치를 보장한다. 부재 시 main 이 settings.language 에서 파생 폴백.
  continuityLang?: ContinuityLang
  // 0067 AC9 — renderer draft 키(UUID). 새 세션의 큐/라우팅 키로 쓰이고 init 에서 실 id 로
  // remap 된다. 절대 영속 금지.
  clientKey?: string
  // 0067 AC5 — 이 메시지의 pending queue 아이템 id(renderer 생성 UUID). 낙관 pending 버블과
  // main 큐·echo 커밋을 잇는 상관키. busy 세션 send(예약)와 idle send(즉시 flush) 공통.
  clientRequestId?: string
}

// Composer 권한 모드 버튼이 노출하는 두 모드. SDK PermissionMode 의 부분집합 —
// 'plan'(읽기 전용·계획) / 'acceptEdits'(파일 편집 자동 수락).
//
// 정규화 어휘와의 관계: 앱 내부 SSOT 는 `NormalizedPermissionMode`(6종, src/shared/permission-mode.ts)
// 이고 이 2종은 그 부분집합이다(`plan`↔'plan', `acceptEdits`↔'accept_edits'). 6종 전체 UI 노출과
// 라이브 전환은 PR③ 에서. 브리지: `fromUiPermissionMode()` (permission-mode.ts).
export type PermissionMode = 'plan' | 'acceptEdits'

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

export interface SchedulerUsageRecomputeSettings {
  enabled: boolean
  cron: string
}

// 자동 업데이트 확인 주기(0156). 앱 (재)시작 시 1회 확인은 이 설정과 무관하게 항상 수행되고,
// enabled 는 *시작 시각을 anchor 로 한* 반복 확인만 제어한다. 허용 값 목록은 여기가 SSOT —
// protocol.ts 의 zod 스키마와 설정 UI 의 select 옵션이 함께 참조한다.
export const UPDATE_CHECK_INTERVAL_HOURS = [1, 6, 12, 24] as const
export type UpdateCheckIntervalHours = (typeof UPDATE_CHECK_INTERVAL_HOURS)[number]

export interface SchedulerUpdateCheckSettings {
  enabled: boolean
  intervalHours: UpdateCheckIntervalHours
}

// 기본값 SSOT — zod 스키마(protocol.ts)와 렌더러 훅이 함께 참조한다. 렌더러는 zod 를 import 할
// 수 없으므로 값이 여기 살아야 두 쪽이 갈라지지 않는다.
export const DEFAULT_UPDATE_CHECK: SchedulerUpdateCheckSettings = {
  enabled: true,
  intervalHours: 6
}

export interface SchedulerSettings {
  usageRecompute: SchedulerUsageRecomputeSettings
  updateCheck: SchedulerUpdateCheckSettings
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
  // 인증 게이트 우회(0157 — 구 ssoBypass). true 면 앱 시작 시 로그인 화면을 건너뛴다
  // (디버그 패널에서 토글, DEV 전용).
  authBypass: boolean
  // 선호 언어(LLM 응답 언어). 시스템 프롬프트 '# User' 헤더로 매 턴 주입. uiLocale 과 별개.
  language: string
  // UI 표시 언어(앱 크롬 로케일, 0096) — 렌더러 i18n(ko/en) + 날짜/시간 포맷 로케일.
  uiLocale: 'ko' | 'en'
  // 계정 지침(설정 모달 프로필 그룹). 시스템 프롬프트 '# User' 헤더로 매 턴 주입.
  accountInstructions: string
  // 앱 전체 폰트. --font-{sans,serif,mono} 에 매핑.
  appFont: 'sans' | 'serif' | 'mono'
  // 응답완료 알림 토글.
  notifyOnComplete: boolean
  // 월간 지출 한도(USD). 사용량 한도 바(도넛·설정)의 기준. null=무제한.
  spendingLimitUsd: number | null
  // 앱 실행 중 주기적 작업 설정. schedule_runs 는 실행 이력이고 이 설정이 재시작 복원 SSOT.
  scheduler: SchedulerSettings
}

export type SettingsPatch = Omit<Partial<Settings>, 'scheduler'> & {
  scheduler?: {
    usageRecompute?: Partial<SchedulerUsageRecomputeSettings>
    updateCheck?: Partial<SchedulerUpdateCheckSettings>
  }
}

// OS 네이티브 알림 요청(renderer → main). 런타임 검증은 protocol.ts NotifyShowSchema.
export interface NotifyShow {
  title: string
  body: string
}

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

// ── git (컴포저 브랜치 칩) ──────────────────────────────────────────────────
// 작업 경로 한 곳에 대한 읽기 2종 + 전환 1종. worktree 는 다루지 않는다(제품 결정).
export interface GitPathRequest {
  cwd: string
}

// 커밋되지 않은 변경 요약 — **추적 파일의 HEAD 대비 차이만** 센다(`git diff HEAD --shortstat`).
// 미추적 파일은 체크아웃을 막지 않으므로 경고·해소 대상에서 일관되게 제외한다.
export interface GitDirtyStat {
  files: number
  insertions: number
  deletions: number
}

export interface GitStatus {
  isRepo: boolean
  // 현재 브랜치명. detached HEAD 이거나 저장소가 아니면 null.
  branch: string | null
  detached: boolean
  // 커밋되지 않은 변경 요약. null = 깨끗함.
  dirty: GitDirtyStat | null
  // 저장소 루트의 절대 경로(`rev-parse --show-toplevel`). 저장소가 아니면 null.
  //
  // **cwd 에서 파생하지 않는 이유**: 작업 경로가 하위 폴더면(`~/proj/orca-skin/app`)
  // basename 이 `app` 이라 저장소 이름이 아니다. 이름을 보여주는 쪽이 루트를 받아야 한다.
  // `--show-toplevel` 만 실패하면 `isRepo:true` 인 채 null 이다 — 이름 자리만 비고
  // 브랜치·변경량은 산다.
  root: string | null
}

export interface GitBranchList {
  current: string | null
  // 로컬 브랜치 이름(현재 브랜치 우선, 나머지는 최근 커밋순). 원격 전용 브랜치는 제외.
  branches: string[]
}

// dirty 트리를 어떻게 처리하고 전환할 것인가 — 모달의 분할 버튼 3선택지와 1:1.
export type GitDirtyResolution = 'stash' | 'commit-wip' | 'discard'

export interface GitCheckoutRequest {
  cwd: string
  branch: string
  // 생략하면 dirty 트리에서 전환하지 않고 `reason:'dirty'` 로 되돌려준다(모달을 띄우라는 신호).
  resolution?: GitDirtyResolution
}

// 전환 실패를 예외가 아니라 값으로 돌려준다 — dirty 트리 충돌은 정상 흐름(사용자에게 물어야
// 하는 상태)이지 프로그래머 오류가 아니다.
//
// **`applied` 는 부분 실패의 식별자다.** 해소(stash/commit-wip/discard)는 성공했는데 그 뒤
// checkout 이 실패하면 사용자 작업 트리는 **이미 바뀌었고 브랜치만 그대로**다. 어느 해소가
// 적용됐는지 값으로 실어야 화면이 "변경은 스태시됐고 브랜치는 그대로"를 말할 수 있다 —
// `discard` 는 되돌릴 수 없으므로 이것이 안 보이면 데이터 유실로 읽힌다.
export type GitCheckoutResult =
  | { ok: true; branch: string }
  | { ok: false; reason: 'dirty'; from: string | null; stat: GitDirtyStat }
  | { ok: false; reason: 'not-repo' | 'error'; message: string; applied?: GitDirtyResolution }

// 세션 카탈로그 (사이드바 "최근 대화") — Phase 3 로컬 DB SSOT.
export interface SessionListItem {
  id: string
  backend: Backend
  title: string | null
  updatedAt: number
  preview: string | null
  projectId: string | null
  cwd: string | null
  // 0129 고정(pin) — 고정 시각(ms). null=미고정. 좌측 nav "고정됨" 섹션 노출/정렬 기준.
  pinnedAt: number | null
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
      // TaskXXX 도구의 SDK 구조화 출력(0204) — 재로드 후에도 작업 타일이 목록을 접을 수 있게
      // 영속한다. 과거 렌더러는 미인식 필드를 무시하므로 전방 호환.
      structuredOutput?: unknown
    }
  | { type: 'file'; path: string; readType?: 'raw' | 'patch'; content?: string }
  | { type: 'diff'; patch: string }
  | { type: 'structured_output'; value: unknown }
  | { type: 'error'; error: unknown }
  // 컴포저 첨부(user 턴) — 트랜스크립트 버블에 썸네일로 렌더하고 DB 에 영속한다.
  | { type: 'attachment'; attachments: AttachmentView[] }
  // 압축 경계 마커(0064 handoff) — session.compacted 를 영속해 재로드 후에도 경계를 표시한다.
  | {
      type: 'compact_boundary'
      trigger?: 'manual' | 'auto'
      preTokens?: number
      postTokens?: number
    }
  // 분기 경계 마커(0064 r5) — fork 물질화 시 복사된 원본 이력과 새 대화 사이에 main 이
  // 영속한다('분기된 지점' 구분선). 렌더러 fork draft 프리필도 같은 위치에 합성해 라이브와
  // 재로드 표시가 일치한다. handoff 는 display 복사가 없어 이 파트를 만들지 않는다.
  | { type: 'fork_boundary' }
  // 백그라운드 서브에이전트 완료 통지(0143) — subagent.task settled + background:true 를 writer
  // (라이브)와 renderer(낙관 커밋)가 이 파트로 물질화한다(toolRunId 멱등 — 같은 태스크 통지는
  // 1개). description 은 싣지 않는다 — 렌더 시 toolRunId 로 부모 tool_call args 와 조인(라이브·
  // 재로드 공통). 과거 렌더러는 미인식 파트를 무시하므로 전방 호환.
  | {
      type: 'subagent_notice'
      toolRunId: string
      status: 'completed' | 'failed' | 'stopped'
      durationMs?: number
      summary?: string
    }

// 백그라운드 완료 통지 파트 조립 — 라이브(renderer chatReducer)와 재로드(main history writer)가
// **같은 내용**을 만들어야 재로드 후 트랜스크립트가 라이브와 동일하게 보인다. 0149: 두 프로세스가
// 각자 조립하던 것을 한 곳으로 모았다(status 기본값·선택 필드 규칙이 갈라질 수 없게).
export function subagentNoticePart(ev: {
  toolUseId: string
  status?: 'completed' | 'failed' | 'stopped'
  durationMs?: number
  summary?: string
}): Extract<AppMessagePart, { type: 'subagent_notice' }> {
  return {
    type: 'subagent_notice',
    toolRunId: ev.toolUseId,
    status: ev.status ?? 'completed',
    ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {}),
    ...(ev.summary !== undefined ? { summary: ev.summary } : {})
  }
}

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
  // 세션 마지막 턴의 provider-reported 통계 — 컨텍스트 도넛/UsagePanel 을 세션 수명 동안
  // 복원(turn_usage 최신 행에서 재구성). 비용 집계는 원장 SUM 으로 별도(추후 usage 화면).
  lastTelemetry?: ProviderReportedTelemetry
  // 이 세션에서만 발생한 비용 총합(USD, 추정치) — turn_usage 세션 SUM(0122 r2).
  // 상태 팝오버 "이 세션에서 사용한 비용" 의 시드. 0 이면 생략.
  costUsd?: number
  // sessions.provider_key — 마지막 사용 provider 기록. null 은 레거시/미매칭 fallback.
  providerKey?: string | null
  projectId?: string | null
  cwd?: string | null
  // 0064 continuity — 이 세션이 fork/handoff 로 파생된 경우의 부모 관계(session_lineage).
  // 렌더러가 출처 배너("원본 열기" 링크)를 복원하는 데 쓴다. parentTitle 은 표시용 스냅샷.
  lineage?: { parentSessionId: string; relation: 'fork' | 'handoff'; parentTitle: string | null }
  activity?: ChatActivitySnapshot
}

// 세션 활동의 단일 main 권위 스냅샷. listen/residual 엣지 이벤트를 각각 갱신하지 않고 같은
// revision에서 원자 적용해 경고·애니메이션의 중간 상태 깜빡임을 막는다.
export interface ChatActivitySnapshot {
  type: 'chat.activity'
  sessionId: string
  revision: number
  foreground: 'idle' | 'preparing' | 'streaming'
  transport: 'idle' | 'listening'
  queuedCount: number
  deliveryPendingCount: number
  residualCount: number
  backgroundTaskCount: number
}

// 프로젝트 (Phase 3+) — 대화 묶음 + 전용 시스템 프롬프트 (instructions).
export interface Project {
  id: string
  name: string
  instructions: string
  createdAt: number
  updatedAt: number
  // 0129 고정(pin) — 고정 시각(ms). null=미고정.
  pinnedAt: number | null
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

// ── Provider 플랫폼 (0181) ────────────────────────────────────────────────────
//
// 0180 이 지운 `auth`/`plugin` DTO 를 **관계 축** 하나로 대체한다. 구 구조는 프로토콜 enum
// (`AuthMechanism`)이 1급 축이라 `AuthMechanism × AuthTargetKind × CredentialPresentation` 이
// 곱해졌다. 여기서는 `kind` 가 **누가 누구를 상대하는가**만 말하고, 프로토콜은 `AuthSpec` 안에
// 접혀 있다.
//
// **이 경계를 넘는 secret 은 없다.** grant 는 상태·만료·표시용 principal 만 싣고, 값은 main 의
// vault(safeStorage)에만 존재한다. main 구현 계약(`Provider`·`AuthSpec`·`Grant`)의 정본은
// `app/src/main/contracts/auth.ts`.

// 관계. **프로토콜이 아니다** — gate=신원 있는 로그인, llm=모델 게이트웨이, service=사내 REST.
export type ProviderKind = 'gate' | 'llm' | 'service'

// 인증 방식. 앞 3종은 입력 수집형(코어 구현), 뒤 2종은 브라우저 흐름형.
export type ProviderAuthKind = 'api-key' | 'password' | 'pat' | 'oauth' | 'browser-session'

export interface ProviderFieldInfo {
  name: string
  label: string
  type: 'text' | 'password'
  required: boolean
}

// 선언된 인증 방식 하나. `fields` 는 입력 수집형에서만 비어 있지 않다(oauth·browser-session 은 []).
export interface ProviderAuthSpecInfo {
  kind: ProviderAuthKind
  label: string
  fields: ProviderFieldInfo[]
}

// 'none' = 인증 이력 없음 · 'unknown' = 저장돼 있으나 복호화 불가(키체인 잠김 등).
// 부재와 복호화 실패를 뭉개지 않는 것이 핵심 — 조용한 미인증 진행을 막는다.
export type ProviderGrantStatus = 'none' | 'valid' | 'expired' | 'unknown'

export interface ProviderInfo {
  id: string
  label: string
  kind: ProviderKind
  origin: string
  // 선언 순서 = GUI 선택지 순서. 길이가 1이면 renderer 는 선택 단계를 건너뛴다.
  auth: ProviderAuthSpecInfo[]
  status: ProviderGrantStatus
  // 지금 무엇으로 인증돼 있는가. 미인증이면 null.
  activeAuthKind: ProviderAuthKind | null
  // 표시용 계정 식별자(비밀 아님). 없으면 null.
  principal: string | null
  expiresAt: number | null
  // 이 provider 가 LLM 에 노출하는 도구의 **완전 이름**(`mcp__<serverId>__<tool>`). 도구를
  // 선언하지 않으면 빈 배열이다.
  //
  // GUI 가 이것을 보여주는 이유: 이름은 `Provider.id` 에서 파생되는데(`<id>-tools`) 화면에
  // id 도 도구 이름도 없어서, 선언과 어긋난 호출이 나도 사용자가 대조할 근거가 없었다.
  tools: string[]
}

// 로그인 진행 단계. 대화형 단계는 `orca:provider:continue` 로 이어진다.
export type ProviderStepInfo =
  | {
      kind: 'input-required'
      providerId: string
      authKind: ProviderAuthKind
      fields: ProviderFieldInfo[]
      message?: string
    }
  // OAuth `redirect:'manual'` — 사용자가 브라우저에서 받은 code 를 붙여 넣는다.
  | { kind: 'code-required'; providerId: string; authKind: ProviderAuthKind; url: string }
  // 부팅 자동 로그인 진행 중 — 복원된 세션 쿠키가 아직 유효한지 probe 로 확인하고 있다.
  // **로그인 화면 위에서** 표시된다(게이트는 확인이 끝날 때까지 닫혀 있다).
  | { kind: 'resuming'; providerId: string }
  | { kind: 'done'; providerId: string }
  | { kind: 'failed'; providerId: string; reason: ProviderFailureReason; message: string }

export type ProviderFailureReason =
  | 'unknown_provider'
  | 'unknown_auth_kind'
  | 'invalid_input'
  | 'cancelled'
  | 'exchange_failed'
  | 'state_mismatch'
  | 'unsupported'
  // 자격증명·세션은 만들어졌지만 `Provider.probe` 가 인증을 확인하지 못했다. 입력 폼이 있는
  // 방식은 이 대신 `input-required` 로 되돌아가므로, 여기 오는 것은 OAuth·브라우저 세션이다.
  | 'probe_failed'

// 게이트 판정. `required` = kind:'gate' provider 선언 여부. **선언 0 이면 통과**가 기본값이라
// dev/OSS 빌드가 로그인 화면에 잠기지 않는다.
export interface ProviderGateState {
  required: boolean
  passed: boolean
  // dev 우회(Settings.authBypass)로 통과했는가 — UI 가 "우회 중" 을 표시할 수 있게.
  bypassed: boolean
}

export interface ProviderPlatformState {
  gate: ProviderGateState
  providers: ProviderInfo[]
  step: ProviderStepInfo | null
  // 게이트는 통과했으나 **나머지 Auth 의 부팅 복원이 아직 진행 중**인가 (0194). 참인 동안
  // renderer 는 메인 셸 대신 대기 화면을 유지한다 — 복원 중에 열리는 로그인 창이 메인 UI
  // 뒤에서 뜨지 않도록.
  //
  // renderer 가 파생할 수 없는 값이라 wire 로만 온다(main 의 배치 진행 상태다).
  resuming: boolean
}

// authKind 미지정 = 선언 배열의 첫 방식(단일 선언이면 GUI 가 고를 것이 없다).
export interface ProviderLoginRequest {
  providerId: string
  authKind?: ProviderAuthKind
  input?: Record<string, string>
}

export interface ProviderContinueRequest {
  providerId: string
  input: Record<string, string>
}

export interface ProviderReauthRequest {
  providerId: string
  authKind?: ProviderAuthKind
}

export interface ProviderRevokeRequest {
  providerId: string
}
