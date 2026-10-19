import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOpencodeClient as createRootClient,
  type BadRequestError,
  type EventSubscribeResponse as RootEventSubscribeResponse,
  type Session
} from '@opencode-ai/sdk'
import {
  createOpencodeClient as createLegacyClient,
  type EventSubscribeResponse as LegacyEventSubscribeResponse
} from '@opencode-ai/sdk/v2'

const baseUrl = 'http://opencode-sdk.test'

const legacyError = {
  name: 'BadRequest',
  data: { message: 'legacy request rejected', kind: 'Body' }
} satisfies BadRequestError

const rootSession = {
  id: 'root-session',
  projectID: 'project-1',
  directory: 'C:/workspace/project-1',
  title: 'Root session',
  version: '1.18.27',
  time: { created: 1_725_336_000_000, updated: 1_725_336_001_000 }
} satisfies Session

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function sseResponse(data: unknown, event: string, id: string): Response {
  const body = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream' }
  })
}

function captureFetch(responses: Response[]): { fetch: typeof fetch; requests: Request[] } {
  const requests: Request[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init))
    const response = responses.shift()
    if (!response) {
      throw new Error('test fetch received an unexpected request')
    }
    return response
  }
  return { fetch, requests }
}

function forbidNetwork(): typeof fetch {
  return async () => {
    throw new Error('test must not use a live network request')
  }
}

async function readSse(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const values: unknown[] = []
  for await (const value of stream) {
    values.push(value)
  }
  return values
}

describe('@opencode-ai/sdk 1.18.27 characterization', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', forbidNetwork())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('root client serializes nested legacy prompt options to the v1 message route', async () => {
    const transport = captureFetch([jsonResponse(legacyError, 400)])
    const client = createRootClient({ baseUrl, fetch: transport.fetch })

    const result = await client.session.prompt({
      path: { id: 'root-session' },
      body: {
        agent: 'build',
        parts: [{ type: 'text', text: 'Root legacy prompt' }]
      }
    })

    expect(result.error).toEqual(legacyError)
    expect(result.data).toBeUndefined()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/session/root-session/message`)
    expect(transport.requests[0]?.method).toBe('POST')
    expect(await transport.requests[0]?.text()).toBe(
      '{"agent":"build","parts":[{"type":"text","text":"Root legacy prompt"}]}'
    )
  })

  it('legacy client serializes flat prompt parameters to the non-api message route', async () => {
    const transport = captureFetch([jsonResponse(legacyError, 400)])
    const client = createLegacyClient({ baseUrl, fetch: transport.fetch })

    const result = await client.session.prompt({
      sessionID: 'legacy-session',
      agent: 'plan',
      parts: [{ type: 'text', text: 'Legacy prompt' }]
    })

    expect(result.error).toEqual(legacyError)
    expect(result.data).toBeUndefined()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/session/legacy-session/message`)
    expect(await transport.requests[0]?.text()).toBe(
      '{"agent":"plan","parts":[{"type":"text","text":"Legacy prompt"}]}'
    )
  })

  it('root client returns a typed successful session from its nested path options', async () => {
    const transport = captureFetch([jsonResponse(rootSession)])
    const client = createRootClient({ baseUrl, fetch: transport.fetch })

    const result = await client.session.get({ path: { id: 'root-session' } })

    expect(result.data).toEqual(rootSession)
    expect(result.error).toBeUndefined()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/session/root-session`)
    expect(transport.requests[0]?.method).toBe('GET')
  })

  it('keeps decoded error fields by default but wraps throwOnError failures with the decoded cause', async () => {
    const transport = captureFetch([jsonResponse(legacyError, 400), jsonResponse(legacyError, 400)])
    const client = createRootClient({ baseUrl, fetch: transport.fetch })
    const options = {
      path: { id: 'error-session' },
      body: { parts: [{ type: 'text' as const, text: 'Error contract' }] }
    }

    const fieldsResult = await client.session.prompt(options)
    expect(fieldsResult.error).toEqual(legacyError)
    expect(fieldsResult.data).toBeUndefined()

    let thrown: unknown
    try {
      await client.session.prompt({ ...options, throwOnError: true })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    if (!(thrown instanceof Error)) {
      throw new Error('throwOnError did not throw an Error')
    }
    expect(thrown.message).toBe('legacy request rejected')
    expect(thrown.cause).toEqual({ body: legacyError, status: 400 })
  })

  it('legacy SSE parses its envelope through the injected fetch transport', async () => {
    const event = {
      id: 'legacy-event',
      type: 'session.idle',
      properties: { sessionID: 'legacy-session' }
    } satisfies LegacyEventSubscribeResponse
    const transport = captureFetch([sseResponse(event, 'server-event', 'legacy-1')])
    const client = createLegacyClient({ baseUrl, fetch: transport.fetch })

    const result = await client.event.subscribe({}, { sseMaxRetryAttempts: 1 })
    expect(await readSse(result.stream)).toEqual([event])
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/event`)
  })

  it('root SSE bypasses configured fetch and uses global fetch; this observed limitation is not production-safe', async () => {
    const configuredTransport = captureFetch([])
    const event = {
      type: 'session.idle',
      properties: { sessionID: 'root-session' }
    } satisfies RootEventSubscribeResponse
    const globalTransport = captureFetch([sseResponse(event, 'root-event', 'root-1')])
    vi.stubGlobal('fetch', globalTransport.fetch)
    const client = createRootClient({ baseUrl, fetch: configuredTransport.fetch })

    const result = await client.event.subscribe({ sseMaxRetryAttempts: 1 })
    expect(await readSse(result.stream)).toEqual([event])
    expect(configuredTransport.requests).toHaveLength(0)
    expect(globalTransport.requests).toHaveLength(1)
    expect(globalTransport.requests[0]?.url).toBe(`${baseUrl}/event`)
  })
})
