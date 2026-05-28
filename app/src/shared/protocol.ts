// zod 스키마 — main 프로세스의 IPC 입력 검증 전용.
// preload (sandbox=true) 에서는 절대 import 하지 말 것: zod 가 require 되어 sandbox 가 거부한다.
// 타입과 CHANNELS 만 필요한 곳은 ./ipc 에서 import.

import { z } from 'zod'
import type { Backend, ChatEvent, ErrorCode } from './ipc'

const BackendSchema: z.ZodType<Backend> = z.enum(['claude-code'])

const ErrorCodeSchema: z.ZodType<ErrorCode> = z.enum([
  'sdk.crashed',
  'sdk.spawn-failed',
  'cli.not-installed',
  'cli.spawn-failed',
  'cli.crashed',
  'cli.timeout',
  'auth.expired',
  'protocol.parse',
  'internal'
])

export const ChatEventSchema: z.ZodType<ChatEvent> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    data: z.object({
      sessionId: z.string(),
      model: z.string().optional(),
      cwd: z.string()
    })
  }),
  z.object({
    type: z.literal('assistant_delta'),
    data: z.object({ text: z.string() })
  }),
  z.object({
    type: z.literal('assistant_message'),
    data: z.object({ text: z.string() })
  }),
  z.object({
    type: z.literal('tool_use'),
    data: z.object({
      toolUseId: z.string(),
      name: z.string(),
      input: z.unknown()
    })
  }),
  z.object({
    type: z.literal('tool_result'),
    data: z.object({
      toolUseId: z.string(),
      output: z.unknown(),
      isError: z.boolean(),
      durationMs: z.number().optional()
    })
  }),
  z.object({
    type: z.literal('result'),
    data: z.object({
      usage: z
        .object({
          inputTokens: z.number(),
          outputTokens: z.number()
        })
        .optional()
    })
  }),
  z.object({
    type: z.literal('error'),
    data: z.object({
      code: ErrorCodeSchema,
      message: z.string(),
      recoverable: z.boolean()
    })
  })
])

export const SendChatMessageSchema = z.object({
  sessionId: z.string().nullable(),
  projectId: z.string().nullable(),
  text: z.string().min(1)
})

export const CancelChatSchema = z.object({ sessionId: z.string() })

export const StartInstallSchema = z.object({ backend: BackendSchema })

export const ListFilesRequestSchema = z.object({
  cwd: z.string().min(1),
  relDir: z.string()
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
  theme: z.enum(['classic', 'dark', 'cool']).default('classic'),
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
  windowBounds: WindowBoundsSchema.nullable().default(null)
})

export const SettingsPatchSchema = z
  .object({
    theme: z.enum(['classic', 'dark', 'cool']),
    density: z.enum(['compact', 'normal', 'comfortable']),
    sidebarCollapsed: z.boolean(),
    sidebarWidth: z.number().int().min(SIDEBAR_WIDTH_MIN).max(SIDEBAR_WIDTH_MAX),
    lastBackend: BackendSchema.nullable(),
    lastSessionId: z.string().nullable(),
    windowBounds: WindowBoundsSchema.nullable()
  })
  .partial()

// 타입 + CHANNELS 단일 출처 (preload / renderer 호환)
export { CHANNELS } from './ipc'
export type {
  Backend,
  ChatEvent,
  ErrorCode,
  SendChatMessage,
  CancelChat,
  BackendListResult,
  StartInstall,
  InstallStatus,
  Settings,
  SettingsPatch,
  SkillInfo,
  ThemePref,
  DensityPref,
  WindowBounds,
  ListFilesRequest,
  FileEntry,
  SessionListItem,
  LoadSessionRequest,
  DeleteSessionRequest,
  RenameSessionRequest,
  LoadedSession,
  LoadedMessage,
  LoadedToolCall,
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
  DeleteMcpServerRequest
} from './ipc'
