import { z } from 'zod'

// Backend (Phase 1: claude-code 단일 백엔드. opencode 는 future work — TRD §10 anchor)
export const BackendSchema = z.enum(['claude-code'])
export type Backend = z.infer<typeof BackendSchema>

// Error code (TRD §6.6)
export const ErrorCodeSchema = z.enum([
  'cli.not-installed',
  'cli.spawn-failed',
  'cli.crashed',
  'cli.timeout',
  'auth.expired',
  'protocol.parse',
  'internal'
])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

// ChatEvent — 어댑터→Renderer 정규화 스트림 (TRD §6.2)
export const ChatEventSchema = z.discriminatedUnion('type', [
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
export type ChatEvent = z.infer<typeof ChatEventSchema>

// IPC payloads (TRD §5.2)
export const SendChatMessageSchema = z.object({
  sessionId: z.string().nullable(),
  text: z.string().min(1)
})
export type SendChatMessage = z.infer<typeof SendChatMessageSchema>

export const CancelChatSchema = z.object({ sessionId: z.string() })
export type CancelChat = z.infer<typeof CancelChatSchema>

export const BackendListResultSchema = z.object({
  backends: z.array(
    z.object({
      id: BackendSchema,
      installed: z.boolean(),
      version: z.string().optional()
    })
  ),
  active: BackendSchema.optional()
})
export type BackendListResult = z.infer<typeof BackendListResultSchema>

export const SelectBackendSchema = z.object({ backend: BackendSchema })
export type SelectBackend = z.infer<typeof SelectBackendSchema>

export const StartInstallSchema = z.object({ backend: BackendSchema })
export type StartInstall = z.infer<typeof StartInstallSchema>

export const InstallStatusSchema = z.object({
  step: z.string(),
  progress: z.number().optional(),
  log: z.string().optional(),
  error: z.string().optional(),
  done: z.boolean().optional()
})
export type InstallStatus = z.infer<typeof InstallStatusSchema>

export const GetSettingsSchema = z.object({ key: z.string() })
export type GetSettings = z.infer<typeof GetSettingsSchema>

export const SetSettingsSchema = z.object({
  key: z.string(),
  value: z.unknown()
})
export type SetSettings = z.infer<typeof SetSettingsSchema>

// IPC channel names (single source of truth)
export const CHANNELS = {
  chatSend: 'orca:chat:send',
  chatEvent: 'orca:chat:event',
  chatCancel: 'orca:chat:cancel',
  backendList: 'orca:backend:list',
  backendSelect: 'orca:backend:select',
  installStart: 'orca:install:start',
  installStatus: 'orca:install:status',
  settingsGet: 'orca:settings:get',
  settingsSet: 'orca:settings:set'
} as const
