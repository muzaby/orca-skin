import { expect, it, vi } from 'vitest'
import { createCreditWire, WIRE_FRAME_CHARS, WIRE_FRAME_TOKENS } from './creditWire'
import { creditWorkerPort } from './creditWorkerPort'
import type { WorkerLike } from './client'
import type { WireControl, WireRequest, WireResponse } from './protocol'
import { findHistoryLayout, rememberHistoryLayout } from '../markdown/historyLayout'
import { markdownSegments } from '../markdown/markdownSegments'
import { parseMarkdown } from './worker/markdown'

it('VP-40 transfers arbitrarily long strings and keys one credit at a time, preserving field order', () => {
  const send: unknown[] = []
  const credits: unknown[] = []
  const consume = vi.fn()
  const sender = createCreditWire((value) => send.push(structuredClone(value)), vi.fn())
  const receiver = createCreditWire((value) => credits.push(structuredClone(value)), consume)
  const wide = '한🦦'.repeat(WIRE_FRAME_CHARS)
  const value = JSON.parse('{"__proto__":{"preserved":true}}')
  value[wide] = { first: undefined, fields: [null, false, wide, 12, ''] }
  sender.send(value, true)
  sender.send('next request', false)
  let count = 0
  while (!consume.mock.calls.length) {
    expect(send).toHaveLength(1)
    const frame = send.shift() as { tokens: [string, unknown][] }
    expect(frame.tokens.length).toBeLessThanOrEqual(WIRE_FRAME_TOKENS)
    expect(
      frame.tokens.reduce((n, token) => n + (typeof token[1] === 'string' ? token[1].length : 0), 0)
    ).toBeLessThanOrEqual(WIRE_FRAME_CHARS)
    receiver.receive(frame)
    expect(send).toHaveLength(0)
    expect(credits).toHaveLength(1)
    sender.receive(credits.shift())
    count++
  }
  expect(count).toBeGreaterThan(5)
  expect(consume.mock.calls[0][0]).toStrictEqual(value)
  expect(Object.getPrototypeOf(consume.mock.calls[0][0])).toBe(Object.prototype)
  expect(send).toEqual(['next request'])
})

it('VP-40 rejects a skipped frame and releases queued work when the owner closes', () => {
  const pending: unknown[] = []
  const consume = vi.fn()
  const sender = createCreditWire((value) => pending.push(value), consume)
  sender.send('x'.repeat(WIRE_FRAME_CHARS * 2), true)
  const receiver = createCreditWire(vi.fn(), consume)
  expect(() => receiver.receive({ channel: 'unexpected', id: 1 })).toThrow(
    'Unknown worker frame channel'
  )
  expect(() => receiver.receive({ ...(pending[0] as object), index: 1 })).toThrow('Out-of-order')
  sender.send('stale', false)
  sender.close()
  sender.receive({ channel: 'oo-credit', id: 1, index: 0 })
  expect(pending).toHaveLength(1)
  expect(consume).not.toHaveBeenCalled()
})

it('VP-41 registers a real Markdown document and receives the same HAST in bounded frames', async () => {
  const toWorker: unknown[] = []
  const toWindow: unknown[] = []
  const endpoint = {
    postMessage: (message: unknown) => toWindow.push(structuredClone(message)),
    onmessage: null as ((event: { data: unknown }) => void) | null
  }
  vi.stubGlobal('self', endpoint)
  try {
    vi.resetModules()
    await import('./worker/markdown.worker')
    const native: WorkerLike = {
      postMessage: (message) => toWorker.push(structuredClone(message)),
      terminate: () => {},
      onmessage: null,
      onerror: null,
      onmessageerror: null
    }
    const renderer = creditWorkerPort(native)
    const receive = vi.fn<(event: { data: unknown }) => void>()
    renderer.onmessage = receive
    const text =
      '[표시](https://example.org/' +
      'q'.repeat(WIRE_FRAME_CHARS * 3) +
      ')\n\n' +
      '줄\n\n'.repeat(90) +
      '**끝**'
    const ref = { id: 'source', revision: 3 }
    renderer.postMessage({ type: 'doc.open', text, ref } satisfies WireControl)
    renderer.postMessage({
      kind: 'markdown',
      doc: ref,
      start: 0,
      end: text.length,
      id: 7
    } satisfies WireRequest)
    let outgoing = 0
    let incoming = 0
    while (toWorker.length || toWindow.length) {
      if (toWorker.length) {
        const msg = toWorker.shift() as { channel?: string; text?: string }
        if (msg.channel === 'oo-frame') outgoing++
        expect(msg.text?.length ?? 0).toBeLessThanOrEqual(WIRE_FRAME_CHARS)
        endpoint.onmessage!({ data: msg })
      }
      if (toWindow.length) {
        const msg = toWindow.shift() as { channel?: string; result?: unknown }
        if (msg.channel === 'oo-frame') incoming++
        expect(msg.result).toBeUndefined()
        native.onmessage!({ data: msg })
      }
    }
    const result = receive.mock.calls[0][0].data as WireResponse
    expect(result.ok && 'result' in result && result.result).toEqual(parseMarkdown(text))
    expect(incoming).toBeGreaterThan(3)
    expect(outgoing).toBeGreaterThan(3)
    renderer.terminate()
  } finally {
    vi.unstubAllGlobals()
  }
})

it('VP-41 reads registered Markdown ranges and whitespace from the credited original text', () => {
  const queue: (() => void)[] = []
  const source = ' '.repeat(WIRE_FRAME_CHARS - 1) + '🦦' + ' '.repeat(80000)
  const blank = ' '.repeat(source.length)
  const consumer = vi.fn()
  const a = createCreditWire((msg) => queue.push(() => b.receive(msg)), vi.fn())
  const b = createCreditWire((msg) => queue.push(() => a.receive(msg)), consumer)
  a.send(
    [
      { type: 'text', text: source },
      { type: 'reasoning', text: blank }
    ],
    true
  )
  while (queue.length) queue.shift()!()
  const [text, reasoning] = consumer.mock.calls[0][0]
  const layout = [{ start: 0, end: source.length, blocks: [{ start: 0, end: source.length }] }]
  rememberHistoryLayout(text, text.text, layout)
  rememberHistoryLayout(reasoning, reasoning.text, layout)
  const registered = findHistoryLayout(text.text)
  expect(registered?.pieces?.slice(WIRE_FRAME_CHARS - 1, WIRE_FRAME_CHARS + 1)).toBe('🦦')
  expect(markdownSegments(text.text, registered!.layout, registered!.pieces)[0].text).toBe(source)
  expect(findHistoryLayout(reasoning.text)?.pieces?.hasContent).toBe(false)
  expect(registered?.pieces?.hasContent).toBe(true)
})

it('VP-40 the Markdown worker renders the extended revision and forgets the old one', async () => {
  const post = vi.fn()
  const scope = {
    postMessage: post,
    onmessage: null as ((event: { data: WireControl | WireRequest }) => void) | null
  }
  vi.stubGlobal('self', scope)
  try {
    vi.resetModules()
    await import('./worker/markdown.worker')
    const from = { id: 'live', revision: 7 }
    const ref = { id: 'live', revision: 8 }
    scope.onmessage!({ data: { type: 'doc.open', ref: from, text: '**보' } })
    scope.onmessage!({ data: { type: 'doc.extend', from, ref, offset: 3, suffix: '임**' } })
    scope.onmessage!({ data: { id: 1, kind: 'markdown', doc: ref, start: 0, end: 6 } })
    scope.onmessage!({ data: { id: 2, kind: 'markdown', doc: from, start: 0, end: 3 } })
    expect(post.mock.calls[0][0].result).toStrictEqual(parseMarkdown('**보임**'))
    expect(post.mock.calls[1][0]).toEqual({ id: 2, ok: false, error: 'unknown-doc' })
  } finally {
    vi.unstubAllGlobals()
  }
})
