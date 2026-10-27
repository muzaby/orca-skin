import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createManagedMcpSource } from './managed-source'
import { ManagedMcpBridge } from './bridge'
import { request as httpRequest } from 'node:http'
import type { RuntimeToolServer } from '../../../../adapters/common/runtime-tools'

it('serves only authorized application tools', async () => {
  let valid = true
  let credential = 1
  const seen: unknown[] = []
  const handler = vi.fn(async (input, context) => {
    seen.push(context)
    if (input.text === 'throw') throw new Error('secret-sentinel-0288')
    if (input.text === 'invalid') return {} as never
    if (input.text === 'wait')
      await new Promise<void>((resolve) =>
        context.getSignal().addEventListener('abort', () => resolve(), { once: true })
      )
    return {
      content: [{ type: 'text' as const, text: input.text }],
      structuredContent: { sentinel: input.text },
      isError: input.text === 'error'
    }
  })
  const server: RuntimeToolServer = {
    descriptor: {
      id: 'builtin-docs',
      connectorId: 'docs',
      executionScope: 'application',
      tools: [
        {
          name: 'lookup',
          description: 'Distinct schema description',
          annotations: { readOnlyHint: true }
        }
      ]
    },
    implementations: [{ name: 'lookup', inputSchema: { text: z.string() }, handler }]
  }
  const source = createManagedMcpSource({
    users: () => ({}),
    resolver: () => () => undefined,
    plugins: () => [
      {
        identity: { kind: 'builtin', sourceId: 'docs', name: '문서', mentionId: 'docs' },
        server,
        authorized: () => valid,
        credentialRevision: () => credential
      },
      {
        identity: { kind: 'builtin', sourceId: 'other', name: '다른 문서', mentionId: 'other' },
        server: { ...server, descriptor: { ...server.descriptor, id: 'other-server' } },
        authorized: () => valid,
        credentialRevision: () => credential
      }
    ]
  })
  source.refresh()
  const bridge = new ManagedMcpBridge(source)
  const first = await bridge.acquire(source.snapshot())
  const second = await bridge.acquire(source.snapshot())
  const endpoint = first.endpoints.get(server.descriptor.id)!
  const headers = { Authorization: `Bearer ${endpoint.token}` }
  const client = new Client({ name: 'orca-test', version: '1' })
  const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), {
    requestInit: { headers }
  })
  try {
    expect(second.endpoints.get(server.descriptor.id)).toEqual(endpoint)
    expect((await fetch(endpoint.url, { method: 'POST', body: '{}' })).status).toBe(401)
    expect(
      (await fetch(endpoint.url, { headers: { ...headers, Origin: 'https://example.test' } }))
        .status
    ).toBe(403)
    const hostStatus = await new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        endpoint.url,
        { headers: { ...headers, Host: 'other.invalid' } },
        (response) => {
          response.resume()
          resolve(response.statusCode!)
        }
      )
      request.on('error', reject)
      request.end()
    })
    expect(hostStatus).toBe(403)
    expect(
      (await fetch(endpoint.url, { method: 'POST', headers, body: 'x'.repeat(1024 * 1024 + 1) }))
        .status
    ).toBe(413)
    await client.connect(transport)
    const other = first.endpoints.get('other-server')!
    expect(
      (await fetch(other.url, { headers: { ...headers, 'mcp-session-id': transport.sessionId! } }))
        .status
    ).toBe(404)
    const listed = await client.listTools()
    expect(listed.tools).toEqual([
      expect.objectContaining({
        name: 'lookup',
        description: 'Distinct schema description',
        annotations: { readOnlyHint: true },
        inputSchema: expect.objectContaining({ required: ['text'] })
      })
    ])
    expect(
      await client.callTool({ name: 'lookup', arguments: { text: 'result-0288' } })
    ).toMatchObject({
      content: [{ type: 'text', text: 'result-0288' }],
      structuredContent: { sentinel: 'result-0288' }
    })
    expect(seen[0]).toEqual({ scope: 'application', getSignal: expect.any(Function) })
    const beforeInvalid = handler.mock.calls.length
    expect((await client.callTool({ name: 'lookup', arguments: { text: 1 } })).isError).toBe(true)
    expect(handler).toHaveBeenCalledTimes(beforeInvalid)
    for (const text of ['throw', 'invalid', 'error']) {
      const result = await client.callTool({ name: 'lookup', arguments: { text } })
      expect(result.isError).toBe(true)
      expect(JSON.stringify(result)).not.toContain('secret-sentinel-0288')
    }
    const cancellation = new AbortController()
    const countBeforeCancellation = handler.mock.calls.length
    const cancelled = client.callTool({ name: 'lookup', arguments: { text: 'wait' } }, undefined, {
      signal: cancellation.signal
    })
    const cancelledAssertion = expect(cancelled).rejects.toThrow()
    await vi.waitFor(() => expect(handler.mock.calls.length).toBe(countBeforeCancellation + 1))
    cancellation.abort()
    await cancelledAssertion
    await vi.waitFor(() =>
      expect((seen.at(-1) as { getSignal(): AbortSignal }).getSignal().aborted).toBe(true)
    )
    await first.release()
    expect(
      (await client.callTool({ name: 'lookup', arguments: { text: 'second-owner' } })).isError
    ).toBe(false)
    const waiting = client.callTool({ name: 'lookup', arguments: { text: 'wait' } })
    await vi.waitFor(() => expect(handler.mock.calls.at(-1)?.[0]).toEqual({ text: 'wait' }))
    valid = false
    source.refresh()
    expect((await waiting).isError).toBe(true)
    const beforeRevoke = handler.mock.calls.length
    expect(
      (await client.callTool({ name: 'lookup', arguments: { text: 'revoked' } })).isError
    ).toBe(true)
    expect(handler).toHaveBeenCalledTimes(beforeRevoke)
    valid = true
    credential++
    source.refresh()
    const next = await bridge.acquire(source.snapshot())
    try {
      const fresh = next.endpoints.get(server.descriptor.id)!
      expect(fresh.token).not.toBe(endpoint.token)
      expect(
        (
          await fetch(fresh.url, {
            headers: {
              Authorization: `Bearer ${fresh.token}`,
              'mcp-session-id': transport.sessionId!
            }
          })
        ).status
      ).toBe(404)
    } finally {
      await next.release()
    }
    expect(
      (await client.callTool({ name: 'lookup', arguments: { text: 'recovered' } })).isError
    ).toBe(false)
  } finally {
    await client.close()
    await first.release()
    await second.release()
    await bridge.close()
  }
  await expect(fetch(endpoint.url, { headers })).rejects.toThrow()
})
