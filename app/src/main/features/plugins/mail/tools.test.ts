import { describe, expect, it, vi } from 'vitest'
import { mailTools } from './tools'
import type { PluginAuth } from '../../../contracts/auth'

// Plugin 은 **auth 자원 + 자기 옵션만** 받는다 (0237 ΔV2 — D-048·D-055). 이 fixture 가 그
// 계약이다 — 여기 없는 것을 도구가 요구하면 컴파일이 깨진다.
function pluginAuth(overrides: Partial<PluginAuth> = {}): PluginAuth {
  return {
    authId: 'mail',
    origin: 'pop3s://pop.example.test:995',
    snapshot: () => ({ authId: 'mail', status: 'valid', verified: true, credentialRevision: 1 }),
    request: () => Promise.reject(new Error('mail plugin does not use HTTP')),
    secret: () => 'user:secret',
    reportAuthFailure: () => undefined,
    ...overrides
  }
}

describe('mail tool surface', () => {
  it('exposes exactly three tools with search as the only read-only operation', () => {
    const server = mailTools(pluginAuth(), {
      plugin: { accountId: 'account' },
      socketFactory: vi.fn(),
      dataDir: 'C:/mail-root'
    })
    expect(server.descriptor.tools.map((tool) => tool.name)).toEqual([
      'mail_sync',
      'mail_search',
      'mail_getAttachment'
    ])
    expect(server.descriptor.tools.map((tool) => tool.annotations?.readOnlyHint)).toEqual([
      false,
      true,
      false
    ])
    expect(server.descriptor.instructions).toContain('attachmentId')
  })

  it('requires both attachment identifiers in the public schema', () => {
    const server = mailTools(pluginAuth({ secret: () => null }), {
      plugin: { accountId: 'account' },
      socketFactory: vi.fn(),
      dataDir: 'C:/mail-root'
    })
    const tool = server.implementations.find((item) => item.name === 'mail_getAttachment')
    expect(tool?.inputSchema).toEqual({
      mailId: expect.anything(),
      attachmentId: expect.anything()
    })
  })
})
