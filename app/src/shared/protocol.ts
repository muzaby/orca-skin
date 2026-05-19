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
  text: z.string().min(1)
})

export const CancelChatSchema = z.object({ sessionId: z.string() })

export const StartInstallSchema = z.object({ backend: BackendSchema })

// Settings (TRD §6.7) — Phase 2+ 영속화. 깨진 디스크 데이터도 default 로 복원되도록
// 모든 키에 default 를 지정한다.
const WindowBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

export const SettingsSchema = z.object({
  theme: z.enum(['classic', 'dark', 'cool']).default('classic'),
  density: z.enum(['compact', 'normal', 'comfortable']).default('normal'),
  sidebarCollapsed: z.boolean().default(false),
  lastBackend: BackendSchema.nullable().default(null),
  lastSessionId: z.string().nullable().default(null),
  windowBounds: WindowBoundsSchema.nullable().default(null)
})

export const SettingsPatchSchema = z
  .object({
    theme: z.enum(['classic', 'dark', 'cool']),
    density: z.enum(['compact', 'normal', 'comfortable']),
    sidebarCollapsed: z.boolean(),
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
  ThemePref,
  DensityPref,
  WindowBounds
} from './ipc'
