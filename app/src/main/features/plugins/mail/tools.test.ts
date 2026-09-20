import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { mailTools } from './tools'
import type { PluginAuth } from '../../../contracts/auth'

const auth: PluginAuth = {
  authId: 'mail',
  label: 'Mail',
  origin: 'pop3s://pop.example.test:995',
  request: vi.fn(),
  snapshot: vi.fn(),
  withCredential: vi.fn()
}

describe('mail tool surface', () => {
  it('exposes exactly three tools with search as the only read-only operation', () => {
    const server = mailTools(auth, { accountId: 'account', host: 'pop.example.test' })
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
    const server = mailTools(auth, { accountId: 'account', host: 'pop.example.test' })
    const tool = server.implementations.find((item) => item.name === 'mail_getAttachment')
    expect(tool?.inputSchema).toEqual({
      mailId: expect.anything(),
      attachmentId: expect.anything()
    })
    const schema = z.object(tool!.inputSchema)
    expect(schema.safeParse({ mailId: '1' }).success).toBe(false)
    expect(schema.safeParse({ attachmentId: '1' }).success).toBe(false)
    expect(schema.safeParse({ mailId: '1', attachmentId: '2' }).success).toBe(true)
  })
})
