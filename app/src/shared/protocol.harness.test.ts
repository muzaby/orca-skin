import { describe, expect, it } from 'vitest'
import {
  CreateEngineSchema,
  ImportEngineUserSettingsSchema,
  SendChatMessageSchema
} from './protocol'

const message = { sessionId: null, projectId: null, text: 'hello' }
const engine = { provider: 'local', settingsJson: '{}' }

describe('harness identity at IPC boundaries', () => {
  it.each(['claude', 'opencode'])('preserves the registered %s harness', (backend) => {
    expect(SendChatMessageSchema.parse({ ...message, backend }).backend).toBe(backend)
    expect(CreateEngineSchema.parse({ ...engine, engine: backend }).engine).toBe(backend)
    expect(ImportEngineUserSettingsSchema.parse({ engine: backend }).engine).toBe(backend)
  })

  it.each(['unknown', 'code', 'work', 'Claude', '', null, true, 1])(
    'rejects an unregistered harness %j in send, engine creation and settings import',
    (backend) => {
      expect(SendChatMessageSchema.safeParse({ ...message, backend }).success).toBe(false)
      expect(CreateEngineSchema.safeParse({ ...engine, engine: backend }).success).toBe(false)
      expect(ImportEngineUserSettingsSchema.safeParse({ engine: backend }).success).toBe(false)
    }
  )

  it('keeps the legacy omitted send/import identity without defaulting engine creation', () => {
    expect(SendChatMessageSchema.parse(message).backend).toBeUndefined()
    expect(ImportEngineUserSettingsSchema.parse(undefined)).toEqual({ engine: 'claude' })
    expect(CreateEngineSchema.safeParse(engine).success).toBe(false)
  })
})
