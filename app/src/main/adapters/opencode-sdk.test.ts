import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createOpencodeClient as createRootClient,
  type BadRequestError,
  type EventSubscribeResponse as RootEventSubscribeResponse,
  type Session
} from '@opencode-ai/sdk'
import {
  createOpencodeClient as createV2Client,
  type EventSubscribeResponse as V2LegacyEventSubscribeResponse,
  type InvalidRequestError,
  type SessionInputAdmitted,
  type V2EventSubscribeResponse
} from '@opencode-ai/sdk/v2'

const baseUrl = 'http://opencode-sdk.test'

const legacyError = {
  name: 'BadRequest',
  data: { message: 'legacy request rejected', kind: 'Body' }
} satisfies BadRequestError

const nativeError = {
  _tag: 'InvalidRequestError',
  message: 'native request rejected',
  kind: 'Body',
  field: 'prompt'
} satisfies InvalidRequestError

const nativeAdmission = {
  admittedSeq: 7,
  id: 'input-7',
  sessionID: 'native-session',
  prompt: { text: 'Native prompt' },
  delivery: 'queue',
  timeCreated: 1_725_336_000_000
} satisfies SessionInputAdmitted

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

  it('v2 legacy client serializes flat prompt parameters to the non-api message route', async () => {
    const transport = captureFetch([jsonResponse(legacyError, 400)])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })

    const result = await client.session.prompt({
      sessionID: 'v2-legacy-session',
      agent: 'plan',
      parts: [{ type: 'text', text: 'V2 legacy prompt' }]
    })

    expect(result.error).toEqual(legacyError)
    expect(result.data).toBeUndefined()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/session/v2-legacy-session/message`)
    expect(await transport.requests[0]?.text()).toBe(
      '{"agent":"plan","parts":[{"type":"text","text":"V2 legacy prompt"}]}'
    )
  })

  it('native client.v2 serializes flat prompt input to the api route', async () => {
    const transport = captureFetch([jsonResponse(nativeError, 400)])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })

    const result = await client.v2.session.prompt({
      sessionID: 'native-session',
      id: 'input-1',
      prompt: { text: 'Native prompt' },
      delivery: 'queue',
      resume: false
    })

    expect(result.error).toEqual(nativeError)
    expect(result.data).toBeUndefined()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/api/session/native-session/prompt`)
    expect(await transport.requests[0]?.text()).toBe(
      '{"id":"input-1","prompt":{"text":"Native prompt"},"delivery":"queue","resume":false}'
    )
  })

  it('native client.v2 preserves the successful { data } response envelope for fields and data styles', async () => {
    const wireResponse = { data: nativeAdmission }
    const transport = captureFetch([jsonResponse(wireResponse), jsonResponse(wireResponse)])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })
    const parameters = {
      sessionID: 'native-session',
      id: 'input-7',
      prompt: { text: 'Native prompt' },
      delivery: 'queue' as const,
      resume: false
    }

    const fieldsResult = await client.v2.session.prompt(parameters)
    const dataResult = await client.v2.session.prompt(parameters, { responseStyle: 'data' })

    if (!fieldsResult.data) {
      throw new Error('successful native prompt did not return a data field')
    }
    expect(fieldsResult.data.data).toEqual(nativeAdmission)
    expect(fieldsResult.error).toBeUndefined()
    expect(dataResult).toEqual(wireResponse)
    expect(transport.requests).toHaveLength(2)
    expect(await transport.requests[0]?.text()).toBe(
      '{"id":"input-7","prompt":{"text":"Native prompt"},"delivery":"queue","resume":false}'
    )
  })

  it('responseStyle data returns undefined for an HTTP failure when throwOnError is false', async () => {
    const transport = captureFetch([jsonResponse(nativeError, 400)])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })

    const result = await client.v2.session.prompt(
      {
        sessionID: 'native-session',
        prompt: { text: 'Rejected native prompt' }
      },
      { responseStyle: 'data' }
    )

    expect(result).toBeUndefined()
    expect(transport.requests).toHaveLength(1)
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

  it('v2 legacy SSE parses its envelope through the injected fetch transport', async () => {
    const event = {
      id: 'legacy-event',
      type: 'session.idle',
      properties: { sessionID: 'v2-legacy-session' }
    } satisfies V2LegacyEventSubscribeResponse
    const transport = captureFetch([sseResponse(event, 'server-event', 'legacy-1')])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })

    const result = await client.event.subscribe({}, { sseMaxRetryAttempts: 1 })
    expect(await readSse(result.stream)).toEqual([event])
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/event`)
  })

  it('native client.v2 SSE parses its envelope through the injected fetch transport', async () => {
    const event = {
      id: 'native-event',
      type: 'server.connected',
      data: { source: 'test fixture' }
    } satisfies V2EventSubscribeResponse
    const transport = captureFetch([sseResponse(event, 'native-event', 'native-1')])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })

    const result = await client.v2.event.subscribe({ sseMaxRetryAttempts: 1 })
    expect(await readSse(result.stream)).toEqual([event])
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe(`${baseUrl}/api/event`)
  })

  it('native client.v2 SSE reports one injected transport failure and ends with its retry limit', async () => {
    const transport = captureFetch([])
    const client = createV2Client({ baseUrl, fetch: transport.fetch })
    let observedError: unknown

    const result = await client.v2.event.subscribe({
      sseMaxRetryAttempts: 1,
      onSseError: (error) => {
        observedError = error
      }
    })

    expect(await readSse(result.stream)).toEqual([])
    expect(transport.requests).toHaveLength(1)
    expect(observedError).toBeInstanceOf(Error)
    if (!(observedError instanceof Error)) {
      throw new Error('SSE transport failure was not reported')
    }
    expect(observedError.message).toBe('test fetch received an unexpected request')
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
