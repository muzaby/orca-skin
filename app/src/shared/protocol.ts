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
  SearchHit
} from './ipc'
