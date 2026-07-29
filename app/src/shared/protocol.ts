// zod 스키마 — main 프로세스의 IPC 입력 검증 전용.
// preload (sandbox=true) 에서는 절대 import 하지 말 것: zod 가 require 되어 sandbox 가 거부한다.
// 타입과 CHANNELS 만 필요한 곳은 ./ipc 에서 import.

import { z } from 'zod'
import { MOCK_SCENARIO_IDS, UPDATE_CHECK_INTERVAL_HOURS } from './ipc'
import type { AttachmentView, Backend, ComposerAttachment, EffortLevel } from './ipc'
import { LOG_EVENT_PATTERN, LOG_SCOPE_MAX_LENGTH, LOG_STRING_MAX_LENGTH } from './logging'
import type { LogInput, SerializedError as LogSerializedError } from './logging'

const BackendSchema: z.ZodType<Backend> = z.enum(['claude'])
const EffortLevelSchema: z.ZodType<EffortLevel> = z.enum(['low', 'medium', 'high', 'xhigh', 'max'])

const AttachmentSourceKindSchema = z.enum(['dialog', 'drag_drop', 'clipboard'])

const ComposerAttachmentSchema: z.ZodType<ComposerAttachment> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('path'),
    path: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative().optional(),
    sourceKind: AttachmentSourceKindSchema
  }),
  z.object({
    kind: z.literal('inline'),
    data: z.string().min(1),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative().optional(),
    sourceKind: AttachmentSourceKindSchema
  })
])

const AttachmentViewSchema: z.ZodType<AttachmentView> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  kind: z.enum(['image', 'file']),
  previewDataUrl: z.string().min(1).optional(),
  sizeBytes: z.number().int().nonnegative().optional()
})

// orca:chat:event 는 main→renderer send(검증 불요)라 NormalizedEvent 용 zod 스키마는 두지 않는다.
// (구 ChatEventSchema 는 ChatEvent 폐기와 함께 제거 — 와이어가 NormalizedEvent 로 전환됨.)

// 정규화 권한 모드 6종 (shared/permission-mode.ts NormalizedPermissionMode 와 일치).
const NormalizedPermissionModeSchema = z.enum([
  'default',
  'accept_edits',
  'plan',
  'dont_ask',
  'bypass',
  'auto_classified'
])

export const SendChatMessageSchema = z
  .object({
    sessionId: z.string().nullable(),
    projectId: z.string().nullable(),
    // handoffFrom 이 있으면 main 이 자동 메시지로 대체하므로 빈 문자열을 허용한다(아래 refine).
    text: z.string(),
    permissionMode: NormalizedPermissionModeSchema.optional(),
    providerKey: z.string().min(1).nullable().optional(),
    modelFamily: z.string().min(1).nullable().optional(),
    effort: EffortLevelSchema.optional(),
    attachments: z.array(ComposerAttachmentSchema).default([]),
    attachmentViews: z.array(AttachmentViewSchema).default([]),
    cwd: z.string().min(1).nullable().optional(),
    // 0064 continuity — 상호 배타·새 세션 전용(아래 refine).
    forkFrom: z.string().min(1).optional(),
    handoffFrom: z.string().min(1).optional(),
    // 0127 — continuity 산출물(제목 마커·핸드오프 자동 메시지) 언어의 draft 생성 시점 스냅샷.
    // renderer draft 제목과 main initialTitle 의 문자열 일치를 보장한다. 부재 시 main 이
    // settings.language 에서 파생(continuityLangFor) 폴백. continuity 전용(아래 refine).
    continuityLang: z.enum(['ko', 'en']).optional(),
    // 0067 AC9 — renderer draft 키(UUID). 새 세션(sessionId=null)의 큐/라우팅 키로 쓰이고
    // init(session.updated)에서 실 session id 로 remap 된다. 절대 영속되지 않는다.
    clientKey: z.string().min(1).optional(),
    // 0067 AC5 — 이 메시지의 pending queue 아이템 id(renderer 생성 UUID). renderer 낙관
    // pending 버블과 main 큐 아이템·echo 커밋을 잇는 상관키.
    clientRequestId: z.string().min(1).optional()
  })
  .superRefine((v, ctx) => {
    if (v.forkFrom !== undefined && v.handoffFrom !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'forkFrom/handoffFrom 은 상호 배타다' })
    }
    if ((v.forkFrom !== undefined || v.handoffFrom !== undefined) && v.sessionId !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'fork/handoff 는 새 세션 send(sessionId=null) 전용이다'
      })
    }
    if (v.handoffFrom === undefined && v.text.length < 1) {
      ctx.addIssue({ code: 'custom', message: 'text 는 비어 있을 수 없다' })
    }
    if (v.continuityLang !== undefined && v.forkFrom === undefined && v.handoffFrom === undefined) {
      ctx.addIssue({ code: 'custom', message: 'continuityLang 은 fork/handoff 전용이다' })
    }
  })

// 0067 AC5: 구 chat:steer 채널은 chat:send 로 흡수 — busy 세션 send 를 main 이 예약(held)으로
// 판정한다. SteerChatMessageSchema 는 폐기.

export const CancelSteerSchema = z.object({
  sessionId: z.string().min(1),
  id: z.string().min(1)
})

export const CancelChatSchema = z.object({ sessionId: z.string() })

// 세션 전체 중단 (orca:chat:discardSession, 0151 r2) — 런타임 폐기로 CLI 큐 잔여를 소멸시킨다.
export const DiscardSessionSchema = z.object({ sessionId: z.string().min(1) })

// 서브에이전트(Task) 단위 중단 (orca:chat:stopSubagent). toolUseId = 부모 Agent 도구 호출 id.
export const StopSubagentSchema = z.object({
  sessionId: z.string().min(1),
  toolUseId: z.string().min(1)
})

// 권한 모드 라이브 전환 (orca:permission:setMode).
export const SetPermissionModeSchema = z.object({
  sessionId: z.string().min(1),
  mode: NormalizedPermissionModeSchema
})

export const StartInstallSchema = z.object({ backend: BackendSchema })

export const UpdateProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  transferred: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  bytesPerSecond: z.number().nonnegative().optional()
})
export const UpdateStateSchema = z.object({
  status: z.enum(['idle', 'checking', 'available', 'downloading', 'ready', 'installing', 'error']),
  currentVersion: z.string().min(1),
  availableVersion: z.string().min(1).optional(),
  releaseNotes: z.string().nullable().optional(),
  progress: UpdateProgressSchema.optional(),
  canInstall: z.boolean(),
  installBlockReason: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  lastError: z.string().min(1).optional(),
  checkedAt: z.number().int().nonnegative().optional()
})
export const UpdateCheckResultSchema = z.object({
  ok: z.boolean(),
  state: UpdateStateSchema,
  reason: z
    .enum(['feed-not-configured', 'check-failed', 'not-available', 'download-failed'])
    .optional()
})
export const UpdateInstallResultSchema = z.object({
  ok: z.boolean(),
  reason: z.enum(['not-ready', 'not-idle', 'internal-error']).optional(),
  message: z.string().optional()
})

export const DebugMockPatchSchema = z
  .object({
    enabled: z.boolean(),
    scenarioId: z.enum(MOCK_SCENARIO_IDS),
    contextUsageRatio: z.number().min(0).max(1),
    log: z.boolean()
  })
  .partial()

export const ListFilesRequestSchema = z.object({
  cwd: z.string().min(1),
  relDir: z.string()
})

export const OpenPathRequestSchema = z.object({ path: z.string().min(1) })

export const ReadAttachmentRequestSchema = z.object({ path: z.string().min(1) })

const SkillNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'skill name 은 영숫자 · _ · - 만 허용')

export const AuthorSkillSchema = z.object({
  name: SkillNameSchema,
  description: z.string().trim().min(1).max(500),
  body: z.string().max(20000).default('')
})

export const UploadSkillSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  content: z.string().max(200000)
})

export const SkillTargetSchema = z.object({
  name: SkillNameSchema,
  sourceId: z.string().min(1).max(128)
})

export const SetSkillEnabledSchema = SkillTargetSchema.extend({
  enabled: z.boolean()
})

export const LoadSessionRequestSchema = z.object({ sessionId: z.string().min(1) })
export const DeleteSessionRequestSchema = z.object({ sessionId: z.string().min(1) })
// 길이 상한 120 — UI 의 표시 한도 60 자보다 여유 있게. 빈 문자열은 무효.
export const RenameSessionRequestSchema = z.object({
  sessionId: z.string().min(1),
  title: z.string().trim().min(1).max(120)
})

// 0129 고정(pin) 토글 — pinned=true 면 main 이 Date.now() 로, false 면 null 로 기록한다.
export const SetSessionPinnedSchema = z.object({
  sessionId: z.string().min(1),
  pinned: z.boolean()
})

// SSO 로그인 (0130) — input 은 LoginView 필드 값(name 키). 값 상한은 폼 입력 보호선.
export const SsoLoginRequestSchema = z.object({
  input: z.record(z.string().max(64), z.string().max(4096)).default({})
})

// Project (Phase 3+) — 시스템 프롬프트 길이 8000 은 Claude Agent SDK 가
// systemPrompt.append 에 허용하는 토큰 한도 대비 여유.
export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  instructions: z.string().max(8000).default('')
})

export const UpdateProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  instructions: z.string().max(8000).optional()
})

export const DeleteProjectSchema = z.object({ id: z.string().min(1) })

export const SetProjectPinnedSchema = z.object({
  id: z.string().min(1),
  pinned: z.boolean()
})

export const ListProjectSessionsSchema = z.object({ projectId: z.string().min(1) })

// 대화 검색 (Phase 3++) — limit 상한 100 은 UI 가 한 번에 보여줄 최대 행 보호선.
// q 최대 길이 200 은 한 모달 입력어로 합리적인 상한 (FTS5 query string 자체에는
// 더 큰 상한이 있지만, UX 상 200 이상이면 검색이 아닌 잘못된 입력).
export const SearchMessagesRequestSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.number().int().positive().max(100).optional()
})

// provider별 사용량 조회/한도 설정 (0080 항목 4). providerKeys 는 renderer 가 아는 agent key
// 목록(agent:list 파생). limitUsd 양수 또는 null(무제한). 상한 100 은 UI 가 다룰 provider 보호선.
export const ProviderSummariesRequestSchema = z.object({
  providerKeys: z.array(z.string().min(1)).max(100)
})

export const RefreshProviderUsageReportSchema = z.object({
  providerKey: z.string().min(1)
})

// 사용량 요약 조회(0112) — 설정 사용량 탭의 기간 탭(최근 7일/30일/전체)과 1:1.
export const UsageStatsRequestSchema = z.object({
  range: z.enum(['7d', '30d', 'all'])
})

export const SetProviderLimitSchema = z.object({
  providerKey: z.string().min(1),
  limitUsd: z.number().positive().nullable()
})

// MCP 서버 설정 (전역). name 은 mcpServers record 의 key 가 되므로 SDK/CLI 가 허용하는
// 식별자 문자만 (도구 이름 `mcp__<name>__<tool>` 의 일부로 들어간다). transport 별 필수
// 필드를 superRefine 으로 검증한다. auth 는 평문 입력 — main 이 safeStorage 로 암호화 저장.
const McpTransportSchema = z.enum(['stdio', 'http'])

const McpServerBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'name 은 영숫자 · _ · - 만 허용'),
  description: z.string().max(500).default(''),
  transport: McpTransportSchema,
  enabled: z.boolean().default(true),
  command: z.string().trim().max(500).optional(),
  args: z.array(z.string().max(500)).max(64).optional(),
  // 미사용 optional 필드는 모달에서 빈 문자열로 전송될 수 있다. 포맷(regex/url) 검증이
  // '' 를 거부하므로 '' → undefined 로 강제해 "비어 있으면 미설정"으로 취급한다.
  authEnvKey: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .trim()
      .max(128)
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'authEnvKey 는 환경변수 이름 규칙을 따라야 함')
      .optional()
  ),
  url: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().trim().url().max(2000).optional()
  ),
  auth: z.string().max(4000).optional()
})

function refineMcpTransport(
  data: { transport: 'stdio' | 'http'; command?: string; url?: string },
  ctx: z.RefinementCtx
): void {
  if (data.transport === 'stdio' && (!data.command || data.command.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'stdio 는 command 필수',
      path: ['command']
    })
  }
  if (data.transport === 'http' && (!data.url || data.url.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'http 는 url 필수', path: ['url'] })
  }
}

export const CreateMcpServerSchema = McpServerBaseSchema.superRefine(refineMcpTransport)

export const UpdateMcpServerSchema = McpServerBaseSchema.partial()
  .extend({ id: z.string().min(1) })
  .superRefine((data, ctx) => {
    // transport 가 주어진 경우에만 해당 필수 필드를 강제 (부분 수정 허용).
    if (data.transport) {
      refineMcpTransport(
        data as { transport: 'stdio' | 'http'; command?: string; url?: string },
        ctx
      )
    }
  })

export const DeleteMcpServerSchema = z.object({ id: z.string().min(1) })

const EngineSchema = z.literal('claude')
const ProviderNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'provider 는 영숫자 · _ · - 만 허용')

export const CreateEngineSchema = z.object({
  engine: EngineSchema,
  provider: ProviderNameSchema,
  settingsJson: z.string().min(1)
})

export const UpdateEngineSchema = z.object({
  key: z.string().min(1),
  settingsJson: z.string().min(1)
})

export const DeleteEngineSchema = z.object({ key: z.string().min(1) })

export const ReadEngineSchema = z.object({ key: z.string().min(1) })

// 권한 응답 단일 스키마 (renderer → main, permissionRespond 채널). ask/plan/tool 세 종류의
// 승인 응답을 ApprovalResolution 2분기로 통일한다. allow 는 updatedInput(ask 답변·plan 입력
// echo)·updatedPermissions("세션 동안 허용")를 선택 동봉, deny 는 message(plan revise 피드백·
// tool 거부 사유)·interrupt(plan reject·turn abort)를 선택 동봉한다.
const PermissionUpdateSchema = z.object({
  toolName: z.string().min(1),
  scope: z.literal('session')
})

// 계획 revise 의 구조화 코멘트 — deny 분기에 옵셔널 동봉. main 이 ORCA_PLAN_FEEDBACK 태그로
// 직렬화한다(prompts/plan-feedback.ts). quote/body 길이는 직렬화 측에서 정규화하므로 여기선
// 형태만 검증한다.
const PlanFeedbackCommentSchema = z.object({
  id: z.string().min(1),
  quote: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  body: z.string()
})

const PlanFeedbackSchema = z.object({
  comments: z.array(PlanFeedbackCommentSchema),
  note: z.string().optional()
})

const ApprovalResolutionSchema = z.discriminatedUnion('behavior', [
  z.object({
    behavior: z.literal('allow'),
    updatedInput: z.unknown().optional(),
    updatedPermissions: z.array(PermissionUpdateSchema).optional()
  }),
  z.object({
    behavior: z.literal('deny'),
    message: z.string().optional(),
    interrupt: z.boolean().optional(),
    planFeedback: PlanFeedbackSchema.optional()
  })
])

export const PermissionRespondSchema = z.object({
  approvalId: z.string().min(1),
  resolution: ApprovalResolutionSchema
})

// Settings (TRD §6.7) — Phase 2+ 영속화. 깨진 디스크 데이터도 default 로 복원되도록
// 모든 키에 default 를 지정한다.
const WindowBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

// 사이드바 폭 범위 — 가독성·접힘 토글(아이콘 폭 56) 과의 충돌 회피를 위해 180–480.
const SIDEBAR_WIDTH_MIN = 180
const SIDEBAR_WIDTH_MAX = 480
const SIDEBAR_WIDTH_DEFAULT = 248
const DEFAULT_USAGE_RECOMPUTE_CRON = '0 */1 * * *'

const SchedulerUsageRecomputeSettingsBaseSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().trim().min(1)
})

const SchedulerUsageRecomputeSettingsSchema = SchedulerUsageRecomputeSettingsBaseSchema.default({
  enabled: false,
  cron: DEFAULT_USAGE_RECOMPUTE_CRON
})

// 자동 업데이트 확인 주기(0156). 앱 (재)시작 시 1회 확인은 이 설정과 무관하게 항상 수행되고,
// 여기서 켜는 것은 *시작 시각을 anchor 로 한* 반복 확인뿐이다. cron 이 아니라 간격인 이유:
// 사용자 요구가 "앱 시작 후 N시간 주기" 라 벽시계 정렬(0/6/12/18시)과 의미가 다르다.
// 값 목록은 ipc.ts 가 SSOT — 설정 UI select 가 같은 배열을 쓴다(잘못된 값은 default 복원).
const DEFAULT_UPDATE_CHECK_INTERVAL_HOURS = 6

const SchedulerUpdateCheckSettingsBaseSchema = z.object({
  enabled: z.boolean(),
  intervalHours: z.literal(UPDATE_CHECK_INTERVAL_HOURS)
})

const SchedulerUpdateCheckSettingsSchema = SchedulerUpdateCheckSettingsBaseSchema.default({
  enabled: true,
  intervalHours: DEFAULT_UPDATE_CHECK_INTERVAL_HOURS
})

const SchedulerSettingsSchema = z
  .object({
    usageRecompute: SchedulerUsageRecomputeSettingsSchema,
    updateCheck: SchedulerUpdateCheckSettingsSchema
  })
  .default({
    usageRecompute: { enabled: false, cron: DEFAULT_USAGE_RECOMPUTE_CRON },
    updateCheck: { enabled: true, intervalHours: DEFAULT_UPDATE_CHECK_INTERVAL_HOURS }
  })

export const DEFAULT_SCHEDULER_SETTINGS = SchedulerSettingsSchema.parse({})

export const SettingsSchema = z.object({
  theme: z.enum(['white', 'dark']).catch('white').default('white'),
  density: z.enum(['compact', 'normal', 'comfortable']).default('normal'),
  sidebarCollapsed: z.boolean().default(false),
  sidebarWidth: z
    .number()
    .int()
    .min(SIDEBAR_WIDTH_MIN)
    .max(SIDEBAR_WIDTH_MAX)
    .default(SIDEBAR_WIDTH_DEFAULT),
  lastBackend: BackendSchema.nullable().default(null),
  lastSessionId: z.string().nullable().default(null),
  windowBounds: WindowBoundsSchema.nullable().default(null),
  // MCP 서버 on/off. 키 = 서버 name. 부재한 서버는 enabled=true 로 간주(McpStore.toDto).
  // enabled 상태는 mcp.json(정의 소스)이 아니라 앱 설정이 보유한다(설계 결정 D2).
  mcpEnabled: z.record(z.string(), z.boolean()).default({}),
  // Orca 전용 per-server 메타(description). mcp.json 은 순정 Claude mcpServers 스키마만
  // 담으므로 Claude 스키마에 없는 필드는 여기(앱 설정)에 둔다. 키 = 서버 name.
  mcpMeta: z.record(z.string(), z.object({ description: z.string().default('') })).default({}),
  skillEnabled: z.record(z.string(), z.boolean()).default({}),
  ssoBypass: z.boolean().default(false),
  // 선호 언어 — LLM 응답 언어. 시스템 프롬프트 '# User' 헤더의 Preferred language 로
  // 매 턴 주입된다(ExtensionBuilder). UI 표시 언어(uiLocale)와 별개 개념.
  language: z.string().default('한국어'),
  // UI 표시 언어(앱 크롬 로케일, 0096) — 렌더러 i18n 카탈로그(ko/en)와 날짜/시간 포맷
  // 로케일을 결정한다. 타임존은 설정이 아니다 — 항상 OS 로컬 타임존을 따른다.
  uiLocale: z.enum(['ko', 'en']).catch('ko').default('ko'),
  // 계정 지침 — 설정 모달 '프로필' 그룹의 textarea. 시스템 프롬프트 '# User' 헤더의
  // Account instructions 로 매 턴 주입된다(ExtensionBuilder).
  accountInstructions: z.string().default(''),
  // 앱 전체 폰트. tokens.css 의 --font-{sans,serif,mono} var 에 매핑(TweakProvider 가 --font-app 적용).
  appFont: z.enum(['sans', 'serif', 'mono']).default('sans'),
  // 응답완료 알림 토글. on 이면 턴 완료 시(창 비활성 한정) OS 네이티브 알림 표시.
  notifyOnComplete: z.boolean().default(false),
  // 월간 지출 한도(USD). 사용량 한도 프로그레스바(도넛·설정)의 기준. null=무제한.
  // 사용량 자체는 계산하지 않는다 — 실사용 SSOT(UsageTracker/costStore)와 이 한도로 파생만.
  spendingLimitUsd: z.number().positive().nullable().default(90),
  scheduler: SchedulerSettingsSchema
})

export const SettingsPatchSchema = z
  .object({
    theme: z.enum(['white', 'dark']),
    density: z.enum(['compact', 'normal', 'comfortable']),
    sidebarCollapsed: z.boolean(),
    sidebarWidth: z.number().int().min(SIDEBAR_WIDTH_MIN).max(SIDEBAR_WIDTH_MAX),
    lastBackend: BackendSchema.nullable(),
    lastSessionId: z.string().nullable(),
    windowBounds: WindowBoundsSchema.nullable(),
    mcpEnabled: z.record(z.string(), z.boolean()),
    mcpMeta: z.record(z.string(), z.object({ description: z.string().default('') })),
    skillEnabled: z.record(z.string(), z.boolean()),
    ssoBypass: z.boolean(),
    language: z.string(),
    uiLocale: z.enum(['ko', 'en']),
    accountInstructions: z.string(),
    appFont: z.enum(['sans', 'serif', 'mono']),
    notifyOnComplete: z.boolean(),
    spendingLimitUsd: z.number().positive().nullable(),
    scheduler: z.object({
      usageRecompute: SchedulerUsageRecomputeSettingsBaseSchema.partial().optional(),
      updateCheck: SchedulerUpdateCheckSettingsBaseSchema.partial().optional()
    })
  })
  .partial()

// 응답완료 등 OS 네이티브 알림 요청(renderer → main). main 이 창 포커스 여부로 표시를 게이트한다.
export const NotifyShowSchema = z.object({
  title: z.string(),
  body: z.string()
})

// 타입 + CHANNELS 단일 출처 (preload / renderer 호환)
export { CHANNELS } from './ipc'
export type {
  Backend,
  ErrorCategory,
  ClassifiedError,
  SendChatMessage,
  CancelSteer,
  ComposerAttachment,
  PickedAttachment,
  OpenPathRequest,
  ReadAttachmentRequest,
  ReadAttachmentResult,
  ConcurrencyEvent,
  CancelChat,
  BackendListResult,
  AgentEnvironment,
  AgentModelView,
  CostPeriodSummary,
  CostSummary,
  ProviderUsageEntry,
  UsageStatsRange,
  UsageStatsDay,
  UsageStatsModel,
  UsageStats,
  SessionCapabilities,
  RevertCapabilities,
  CancellationCapability,
  ProviderDescriptor,
  StartInstall,
  InstallStatus,
  SchedulerSettings,
  SchedulerUsageRecomputeSettings,
  Settings,
  SettingsPatch,
  NotifyShow,
  SsoFieldSpec,
  SsoIdentity,
  SsoState,
  SkillInfo,
  AuthorSkillRequest,
  UploadSkillRequest,
  SetSkillEnabledRequest,
  SkillTargetRequest,
  ThemePref,
  DensityPref,
  WindowBounds,
  ListFilesRequest,
  FileEntry,
  SessionListItem,
  SessionTitleEvent,
  LoadSessionRequest,
  DeleteSessionRequest,
  RenameSessionRequest,
  LoadedSession,
  LoadedMessage,
  AppMessagePart,
  ProviderReportedTelemetry,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeleteProjectRequest,
  ListProjectSessionsRequest,
  SearchMessagesRequest,
  SearchHit,
  McpTransport,
  McpServer,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
  DeleteMcpServerRequest,
  AskQuestionOption,
  AskQuestion,
  AskQuestionRequest,
  AskResult,
  PermissionMode,
  PermissionAction,
  PermissionUpdate,
  PermissionRespond,
  SetPermissionMode,
  ApprovalResolution,
  PlanReviewRequest,
  PlanDecision,
  MockScenarioId,
  DebugMockState,
  CreateEngineRequest,
  UpdateEngineRequest,
  DeleteEngineRequest,
  ReadEngineRequest,
  EngineReadResult,
  EngineWriteResult,
  EngineUserSettingsResult,
  UpdateState,
  UpdateProgress,
  UpdateCheckResult,
  UpdateInstallResult
} from './ipc'

// ── 로그 인제스트 (0123) ─────────────────────────────────────────────────────
// renderer/preload 가 보낸 LogInput 의 신뢰 경계 검증. 공통 필드(timestamp 등)는 스키마
// 대상이 아니다 — 보내와도 main 이 무시하고 강제 부여한다(strict 라 아예 거부됨).

const LOG_DATA_MAX_DEPTH = 6
const LOG_DATA_MAX_KEYS = 64
const LOG_DATA_MAX_ARRAY = 128
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// data 트리 검사 — 프로토타입 오염 가능 키·과도한 깊이/폭을 신뢰 경계에서 거부한다.
function validateDataTree(value: unknown, depth: number): string | null {
  if (depth > LOG_DATA_MAX_DEPTH) return `depth > ${LOG_DATA_MAX_DEPTH}`
  if (typeof value === 'string') {
    return value.length > LOG_STRING_MAX_LENGTH ? `string > ${LOG_STRING_MAX_LENGTH}` : null
  }
  if (Array.isArray(value)) {
    if (value.length > LOG_DATA_MAX_ARRAY) return `array > ${LOG_DATA_MAX_ARRAY}`
    for (const item of value) {
      const bad = validateDataTree(item, depth + 1)
      if (bad) return bad
    }
    return null
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length > LOG_DATA_MAX_KEYS) return `keys > ${LOG_DATA_MAX_KEYS}`
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) return `forbidden key: ${key}`
      const bad = validateDataTree((value as Record<string, unknown>)[key], depth + 1)
      if (bad) return bad
    }
    return null
  }
  return null
}

const LogBoundedString = z.string().max(LOG_STRING_MAX_LENGTH)

const LogSerializedErrorSchema: z.ZodType<LogSerializedError> = z.lazy(() =>
  z
    .object({
      name: LogBoundedString,
      message: LogBoundedString,
      code: LogBoundedString.optional(),
      stack: LogBoundedString.optional(),
      cause: LogSerializedErrorSchema.optional()
    })
    .strict()
)

const LogInputObjectSchema = z
  .object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    event: z.string().min(3).max(128).regex(LOG_EVENT_PATTERN),
    scope: z
      .string()
      .min(1)
      .max(LOG_SCOPE_MAX_LENGTH)
      .regex(/^[a-z][a-z0-9._-]*$/),
    message: LogBoundedString.optional(),
    correlationId: z.string().max(128).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    error: LogSerializedErrorSchema.optional()
  })
  .strict()

// data 트리 검사는 zod 파싱 *이전*(raw)에 한다 — z.record 가 파싱 시 객체를 복사하며
// JSON.parse 산 `__proto__` own-key 를 프로토타입 대입으로 소실시키므로, 파싱 후 검사는
// 오염 키를 놓친다. raw 원본에서만 Object.keys 로 관찰 가능하다.
export const LogInputSchema: z.ZodType<LogInput> = z
  .unknown()
  .superRefine((raw, ctx) => {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const data = (raw as Record<string, unknown>).data
      if (data !== undefined) {
        const bad = validateDataTree(data, 1)
        if (bad) ctx.addIssue({ code: 'custom', message: `data rejected: ${bad}` })
      }
    }
  })
  .pipe(LogInputObjectSchema)
