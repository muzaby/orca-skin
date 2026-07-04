// zod 스키마 — main 프로세스의 IPC 입력 검증 전용.
// preload (sandbox=true) 에서는 절대 import 하지 말 것: zod 가 require 되어 sandbox 가 거부한다.
// 타입과 CHANNELS 만 필요한 곳은 ./ipc 에서 import.

import { z } from 'zod'
import { MOCK_SCENARIO_IDS } from './ipc'
import type { AttachmentView, Backend, ComposerAttachment, EffortLevel } from './ipc'

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
    handoffFrom: z.string().min(1).optional()
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
  })

export const SteerChatMessageSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
  clientRequestId: z.string().min(1).optional()
})

export const CancelSteerSchema = z.object({
  sessionId: z.string().min(1),
  id: z.string().min(1)
})

export const CancelChatSchema = z.object({ sessionId: z.string() })

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

export const DebugMockPatchSchema = z
  .object({
    enabled: z.boolean(),
    scenarioId: z.enum(MOCK_SCENARIO_IDS),
    contextUsageRatio: z.number().min(0).max(1),
    wireLog: z.boolean()
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

export const ListProjectSessionsSchema = z.object({ projectId: z.string().min(1) })

// 대화 검색 (Phase 3++) — limit 상한 100 은 UI 가 한 번에 보여줄 최대 행 보호선.
// q 최대 길이 200 은 한 모달 입력어로 합리적인 상한 (FTS5 query string 자체에는
// 더 큰 상한이 있지만, UX 상 200 이상이면 검색이 아닌 잘못된 입력).
export const SearchMessagesRequestSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.number().int().positive().max(100).optional()
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
  skillEnabled: z.record(z.string(), z.boolean()).default({})
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
    skillEnabled: z.record(z.string(), z.boolean())
  })
  .partial()

// 타입 + CHANNELS 단일 출처 (preload / renderer 호환)
export { CHANNELS } from './ipc'
export type {
  Backend,
  ErrorCategory,
  ClassifiedError,
  SendChatMessage,
  SteerChatMessage,
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
  SessionCapabilities,
  RevertCapabilities,
  CancellationCapability,
  ProviderDescriptor,
  StartInstall,
  InstallStatus,
  Settings,
  SettingsPatch,
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
  EngineWriteResult
} from './ipc'
