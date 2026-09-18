import { describe, expect, it, vi } from 'vitest'
import { mailTools } from './tools'

describe('mail tool surface', () => {
  it('exposes exactly three tools with search as the only read-only operation', () => {
    const server = mailTools(
      {
        authId: 'mail',
        password: () => 'secret',
        root: 'C:/mail-root',
        socketFactory: vi.fn()
      },
      { plugin: { accountId: 'account', host: 'pop.example.test' } }
    )
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
    const server = mailTools(
      {
        authId: 'mail',
        password: () => null,
        root: 'C:/mail-root',
        socketFactory: vi.fn()
      },
      { plugin: { accountId: 'account', host: 'pop.example.test' } }
    )
    const tool = server.implementations.find((item) => item.name === 'mail_getAttachment')
    expect(tool?.inputSchema).toEqual({
      mailId: expect.anything(),
      attachmentId: expect.anything()
    })
  })
})
