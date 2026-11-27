import { installHistoryWorker } from '../../../../shared/compute/historyWorker.testfixture'
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { rendererLog } from '../../../../shared/logging'
import { createHistoryBodyDecoder } from '../../../../shared/compute/worker/historyBody'
import {
  createComputeClient,
  setComputeClient,
  type WorkerLike,
  type ComputeHandle
} from '../../../../shared/compute/client'
import {
  HISTORY_BODY_BYTES,
  type HistoryBodyRef,
  type HistoryPageReply,
  type HistoryQuery
} from '../../../../../../shared/history-page'
import { sessionApi } from '../../../../shared/api/ipc'
import { installFakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import type { Message } from '../../reducer/chatReducer'
import { DeferredBody } from '../../harnesses/common/transcript/DeferredBody'
import { chatActions, useChatStore } from '../../store/chatStore'
import { installChatStoreHarness } from '../../store/chatStore.testHarness'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key })
}))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

installHistoryWorker()

it('retries a deferred body from its button and resolves the original message in place', async () => {
  vi.useFakeTimers()
  const parts = [{ type: 'text', text: '다시 연 본문' }]
  const bytes = Buffer.from(JSON.stringify(parts))
  const body: HistoryBodyRef = {
    kind: 'parts',
    session: 's',
    generation: 'published',
    message: 'target',
    bytes: bytes.length
  }
  const messages = ['before', 'target', 'after'].map((id) => ({
    id,
    role: 'assistant' as const,
    createdAt: 1,
    parts: [],
    ...(id === 'target' ? { deferredBody: body } : {})
  }))
  installChatStoreHarness({ messages })
  const original = useChatStore.getState().sessions.s
  useChatStore.setState({
    sessions: {
      s: {
        ...original,
        history: { generation: body.generation, openGeneration: 9 }
      }
    }
  })
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const open = vi.spyOn(chatActions, 'openHistoryBody')
  const page = vi
    .spyOn(sessionApi, 'page')
    .mockRejectedValueOnce(Error('interrupted'))
    .mockResolvedValueOnce({
      status: 'body',
      generation: body.generation,
      bytes: bytes.length,
      sessionId: 's',
      openGeneration: 9,
      requestId: 2,
      offset: 0,
      nextOffset: bytes.length,
      done: true,
      base64: bytes.toString('base64')
    })
  try {
    const element = createElement(DeferredBody, { body })
    dom.render(element)
    expect(dom.query('[type="button"]')).toBeNull()
    expect(await chatActions.openHistoryBody(body)).toBe(false)
    dom.render(element)
    expect(dom.query('[type="button"]')?.textContent).toBe('chat.transcript.historyRetry')
    expect(useChatStore.getState().sessions.s.session.messages[1].deferredBody).toBe(body)
    dom.click(dom.query('[type="button"]')!)
    expect(await open.mock.results[1].value).toBe(true)
    const current = useChatStore.getState().sessions.s.session.messages
    expect(current.map((m) => m.id)).toEqual(['before', 'target', 'after'])
    expect(current[1].deferredBody).toBeUndefined()
    expect(current[1].parts).toEqual(parts)
    expect(page.mock.calls.map(([query]) => query)).toEqual(
      Array(2).fill({
        kind: 'body',
        ref: body,
        sessionId: 's',
        openGeneration: 9,
        offset: 0
      })
    )
  } finally {
    dom.unmount()
  }
})

it.each(['active session', 'selection', 'publication', 'ref', 'before commit'] as const)(
  'checks a pending deferred body after a change of %s and shares the request',
  async (change) => {
    const parts = Buffer.from('[{"type":"text","text":"late"}]')
    const ref: HistoryBodyRef = {
      kind: 'parts',
      session: 's',
      generation: 'g',
      message: 'same',
      bytes: parts.length
    }
    const messages = [
      { id: 'same', role: 'assistant' as const, parts: [], createdAt: 1, deferredBody: ref }
    ]
    installChatStoreHarness({ messages })
    const installed = useChatStore.getState().sessions.s
    const entry = { ...installed, history: { generation: 'g', openGeneration: 7 } }
    useChatStore.setState({ sessions: { s: entry } })
    const response = {
      status: 'body' as const,
      generation: ref.generation,
      bytes: parts.length,
      sessionId: 's',
      openGeneration: 7,
      requestId: 1,
      offset: 0,
      nextOffset: parts.length,
      done: true,
      base64: parts.toString('base64')
    }
    let finish!: (r: typeof response) => void
    const page = vi.spyOn(sessionApi, 'page').mockReturnValue(
      new Promise((r) => {
        finish = r
      })
    )
    const first = chatActions.openHistoryBody(ref)
    expect(chatActions.openHistoryBody(ref)).toBe(first)
    expect(page).toHaveBeenCalledTimes(1)
    finish(response)
    if (change === 'before commit') await Promise.resolve()
    switch (change) {
      case 'active session':
      case 'before commit':
        useChatStore.setState({ activeKey: 'other' })
        break
      case 'selection':
        useChatStore.setState({
          sessions: {
            s: { ...entry, search: { seq: 9, target: 'same', restore: false, keyboard: false } }
          }
        })
        break
      case 'publication':
        useChatStore.setState({
          sessions: { s: { ...entry, history: { ...entry.history, generation: 'new' } } }
        })
        break
      case 'ref':
        useChatStore.setState({
          sessions: {
            s: {
              ...entry,
              session: {
                ...entry.session,
                messages: [{ ...messages[0], deferredBody: { ...ref } }]
              }
            }
          }
        })
        break
    }
    expect(await first).toBe(change === 'publication')
    expect(useChatStore.getState().sessions.s.session.messages[0].parts).toEqual(
      change === 'publication' ? [{ type: 'text', text: 'late' }] : []
    )
  }
)

function mountBody(bytes: Buffer): {
  ref: HistoryBodyRef
  dom: ReturnType<typeof installFakeDom>
  render: () => void
  parts: () => Message['parts']
} {
  const ref: HistoryBodyRef = {
    kind: 'parts',
    session: 's',
    generation: 'old',
    message: 'answer',
    bytes: bytes.length
  }
  installChatStoreHarness({
    messages: [{ id: ref.message, role: 'assistant', createdAt: 1, parts: [], deferredBody: ref }]
  })
  const entry = useChatStore.getState().sessions.s
  useChatStore.setState({
    sessions: { s: { ...entry, history: { generation: ref.generation, openGeneration: 17 } } }
  })
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const element = createElement(DeferredBody, { body: ref })
  const render = (): void => dom.render(element)
  render()
  const parts = (): Message['parts'] => useChatStore.getState().sessions.s.session.messages[0].parts
  return { ref, dom, render, parts }
}

function chunk(q: HistoryQuery, bytes: Buffer, generation: string): HistoryPageReply {
  if (q.kind !== 'body') throw Error(q.kind)
  const packet = bytes.subarray(q.offset, q.offset + HISTORY_BODY_BYTES)
  const nextOffset = q.offset + packet.length
  return {
    status: 'body',
    offset: q.offset,
    nextOffset,
    done: nextOffset === bytes.length,
    base64: packet.toString('base64'),
    requestId: 1,
    sessionId: q.sessionId,
    openGeneration: q.openGeneration,
    generation,
    bytes: bytes.length
  }
}

it('AC3″ renders the current generation after a generation change', async () => {
  const old = Buffer.from(JSON.stringify([{ type: 'text', text: 'old'.repeat(24000) }]))
  const current = [{ type: 'text', text: 'new'.repeat(33000) }]
  const bytes = Buffer.from(JSON.stringify(current))
  const body = mountBody(old)
  const log = vi.spyOn(rendererLog, 'warn')
  let sent = 0
  const page = vi
    .spyOn(sessionApi, 'page')
    .mockImplementation(async (q) => (++sent === 1 ? chunk(q, old, 'old') : chunk(q, bytes, 'new')))
  try {
    expect(await chatActions.openHistoryBody(body.ref)).toBe(true)
    body.render()
    expect(body.dom.query('[type="button"]')).toBeNull()
    expect(body.parts()).toEqual(current)
    expect(page.mock.calls.map(([q]) => q.kind === 'body' && q.offset)).toEqual([
      0,
      HISTORY_BODY_BYTES,
      0,
      HISTORY_BODY_BYTES
    ])
    expect(log.mock.calls.filter(([event]) => event === 'history.body.failed')).toHaveLength(0)
  } finally {
    body.dom.unmount()
  }
})

it.each(['stale', 'invalid', 'unavailable', 'cancelled', 'worker', 'churn', 'transport'] as const)(
  'AC3″ logs one %s reason and exposes a single manual retry',
  async (reason) => {
    vi.useFakeTimers()
    const bytes = Buffer.from(JSON.stringify([{ type: 'text', text: 'a'.repeat(70000) }]))
    const body = mountBody(bytes)
    let round = 0
    const log = vi.spyOn(rendererLog, 'warn')
    const page = vi.spyOn(sessionApi, 'page').mockImplementation(async (q) => {
      if (q.kind !== 'body') throw Error(q.kind)
      if (reason === 'transport') throw Error('closed transport')
      if (reason === 'worker') return chunk(q, Buffer.from('[{}]'), 'g')
      if (reason === 'churn') {
        if (q.offset !== 0) round++
        return chunk(q, bytes, 'generation-' + round)
      }
      return {
        status: reason,
        requestId: 1,
        sessionId: q.sessionId,
        openGeneration: q.openGeneration
      }
    })
    try {
      expect(await chatActions.openHistoryBody(body.ref)).toBe(false)
      body.render()
      expect(body.dom.query('[type="button"]')?.textContent).toBe('chat.transcript.historyRetry')
      expect(log.mock.calls.filter(([event]) => event === 'history.body.failed')).toEqual([
        [
          'history.body.failed',
          'chat',
          { kind: 'historyBody', lane: 'compute', reason, sessionId: 's', messageKey: 'answer' }
        ]
      ])
      expect(page).toHaveBeenCalledTimes(reason === 'churn' ? 6 : 1)
      const good = Buffer.from('[{"type":"text","text":"retry succeeded"}]')
      page.mockImplementation(async (q) => chunk(q, good, 'after'))
      body.dom.click(body.dom.query('[type="button"]')!)
      await vi.waitFor(() =>
        expect(body.parts()).toEqual([{ type: 'text', text: 'retry succeeded' }])
      )
      expect(page).toHaveBeenCalledTimes(reason === 'churn' ? 7 : 2)
    } finally {
      body.dom.unmount()
    }
  }
)

function workerForBody(onHealth?: (reply: () => void) => void): WorkerLike {
  const decode = createHistoryBodyDecoder()
  const port: WorkerLike = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminate: vi.fn(),
    postMessage(message) {
      if ('type' in message) {
        if (message.type === 'health')
          onHealth?.(() => port.onmessage?.({ data: { id: message.id, ok: 'ready' } }))
      } else if (message.kind === 'historyBody') {
        queueMicrotask(() => {
          try {
            const result = decode(message)
            port.onmessage?.({ data: { id: message.id, ok: true, result, size: 0 } })
          } catch (error) {
            port.onmessage?.({
              data: { id: message.id, ok: false, error: (error as Error).message }
            })
          }
        })
      }
    }
  }
  return port
}

it('AC20 retries a worker-failed body once after recovery', async () => {
  const bytes = Buffer.from('[{"type":"text","text":"recovered"}]')
  const body = mountBody(bytes)
  let recover: (() => void) | undefined
  const factory = vi.fn(() =>
    workerForBody((reply) => {
      recover = reply
    })
  )
  factory.mockImplementationOnce(() => {
    throw Error('worker cannot start')
  })
  setComputeClient(createComputeClient({ createWorker: factory }))
  const page = vi.spyOn(sessionApi, 'page').mockImplementation(async (q) => chunk(q, bytes, 'g'))
  try {
    expect(await chatActions.openHistoryBody(body.ref)).toBe(false)
    body.render()
    expect(body.dom.query('[type="button"]')).not.toBeNull()
    await vi.waitFor(() => expect(recover).toBeDefined())
    expect(page).toHaveBeenCalledTimes(1)
    recover!()
    await vi.waitFor(() => expect(body.parts()).toEqual([{ type: 'text', text: 'recovered' }]))
    body.render()
    expect(body.dom.query('[type="button"]')).toBeNull()
    expect(page).toHaveBeenCalledTimes(2)
  } finally {
    body.dom.unmount()
  }
})

it('AC3″ survives a worker replacement when a running diff pair is cancelled', async () => {
  const parts = [{ type: 'text', text: 'actual body '.repeat(9000) }]
  const bytes = Buffer.from(JSON.stringify(parts))
  const body = mountBody(bytes)
  const workers: WorkerLike[] = []
  const client = createComputeClient({
    createWorker() {
      const w = workerForBody()
      workers.push(w)
      return w
    }
  })
  setComputeClient(client)
  const left = client.openDocument({ id: 'left', revision: 1 }, { text: 'left' }, 'compute')
  const right = client.openDocument({ id: 'right', revision: 1 }, { text: 'right' }, 'compute')
  let pair: ComputeHandle<unknown> | undefined
  let cancelled: Promise<unknown> | undefined
  const requests: number[] = []
  vi.spyOn(sessionApi, 'page').mockImplementation(async (q) => {
    if (q.kind !== 'body') throw Error(q.kind)
    requests.push(q.offset)
    if (requests.length === 2) {
      pair = client.request({
        kind: 'diffView',
        source: { kind: 'pair', old: left.ref, new: right.ref },
        options: {
          layout: 'inline',
          ignoreWhitespace: false,
          highlightWords: false,
          expansions: []
        },
        start: 0,
        end: 1
      })
      cancelled = pair.promise.catch((e: unknown) => e)
    }
    return chunk(q, bytes, 'g')
  })
  const log = vi.spyOn(rendererLog, 'warn')
  try {
    const reading = chatActions.openHistoryBody(body.ref)
    await vi.waitFor(() => expect(pair).toBeDefined())
    pair!.cancel()
    await cancelled
    expect(await reading).toBe(true)
    expect(workers).toHaveLength(2)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(requests).toEqual([0, HISTORY_BODY_BYTES, 0, HISTORY_BODY_BYTES])
    expect(body.parts()).toEqual(parts)
    body.render()
    expect(body.dom.query('[type="button"]')).toBeNull()
    expect(log.mock.calls.filter(([e]) => e === 'history.body.failed')).toHaveLength(0)
  } finally {
    left.release()
    right.release()
    body.dom.unmount()
  }
})
