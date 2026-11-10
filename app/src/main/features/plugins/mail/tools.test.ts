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
  it('exposes four tools with local search and get as read-only operations', () => {
    const server = mailTools(auth, { accountId: 'account' })
    expect(server.descriptor.tools.map((tool) => tool.name)).toEqual([
      'mail_sync',
      'mail_search',
      'mail_getAttachment',
      'mail_get'
    ])
    expect(server.descriptor.tools.map((tool) => tool.annotations?.readOnlyHint)).toEqual([
      false,
      true,
      false,
      true
    ])
    expect(server.implementations.map((tool) => tool.name)).toEqual(
      server.descriptor.tools.map((tool) => tool.name)
    )
    expect(server.descriptor.tools[3].annotations).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false
    })
    for (const word of ['attachmentId', 'mail_get', 'nextOffset', 'full'])
      expect(server.descriptor.instructions).toContain(word)
  })

  it('requires both attachment identifiers in the public schema', () => {
    const server = mailTools(auth, { accountId: 'account' })
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

it('keeps search inputs unchanged and validates the new get and sync inputs', () => {
  const server = mailTools(auth, { accountId: 'account' })
  expect(Object.keys(server.implementations[1].inputSchema).sort()).toEqual(['limit', 'query'])
  const get = z.object(server.implementations[3].inputSchema)
  expect(get.safeParse({ mailId: '1' }).success).toBe(true)
  expect(get.safeParse({ mailId: '1', offset: 37, maxChars: 113 }).success).toBe(true)
  for (const input of [
    {},
    { mailId: '' },
    { mailId: '1', offset: -1 },
    { mailId: '1', offset: 1.5 },
    { mailId: '1', maxChars: 0 },
    { mailId: '1', maxChars: 1.5 },
    { mailId: '1', maxChars: 16001 }
  ])
    expect(get.safeParse(input).success).toBe(false)
  const sync = z.object(server.implementations[0].inputSchema)
  for (const mode of ['incremental', 'full', undefined])
    expect(sync.safeParse({ mode }).success).toBe(true)
  for (const mode of ['all', '', 1]) expect(sync.safeParse({ mode }).success).toBe(false)
})
