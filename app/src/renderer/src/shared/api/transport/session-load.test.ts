// 창 쪽 세션 본문 조립 (0324 EP-4′ · AC15~AC17).
import { describe, expect, it, vi } from 'vitest'
import { SESSION_LOAD_CANCELLED, type ChunkedSession } from '../../../../../shared/data-host'
import type { LoadedMessage } from '../../../../../shared/ipc'
import { createSessionLoadClient } from './session-load'

const CHANNELS = { load: 'load', refresh: 'refresh', chunk: 'chunk', cancel: 'cancel' }
const message = (text: string): LoadedMessage => ({
  id: text,
  role: 'user',
  createdAt: 1,
  parts: [{ type: 'text', text }]
})
const head = (id: string, chunks: number, messages: number): ChunkedSession => ({
  id,
  backend: 'claude',
  agentKind: 'code',
  title: `제목-${id}`,
  messages: [],
  chunked: { chunks, messages }
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(paged = false) {
  const calls: Array<{ channel: string; payload: { sessionId: string; requestId: number } }> = []
  const replies = new Map<number, (value: unknown) => void>()
  const sent: Array<[string, unknown]> = []
  let onChunk: (payload: unknown) => void = () => {}
  const client = createSessionLoadClient({
    invoke: (channel, payload) => {
      const request = payload as { sessionId: string; requestId: number }
      calls.push({ channel, payload: request })
      return new Promise((resolve) => replies.set(request.requestId, resolve))
    },
    send: (channel, payload) => void sent.push([channel, payload]),
    subscribe: (channel, handler) => {
      expect(channel).toBe(CHANNELS.chunk)
      onChunk = handler
      return () => {}
    },
    channels: paged ? { ...CHANNELS, page: 'history-page' } : CHANNELS
  })
  return {
    client,
    calls,
    sent,
    chunk: (requestId: number, seq: number, messages: LoadedMessage[]) =>
      onChunk({ requestId, seq, messages }),
    reply: (requestId: number, value: unknown) => replies.get(requestId)!(value)
  }
}

describe('세션 본문 조립', () => {
  // 0325 VP-01 — 상한 이전 형상(한 조각 200,000건)과 상한 형상(400조각) 모두 인자 펼침 없이 조립한다.
  it('200,000건을 한 조각·400조각으로 받아도 순서대로 조립한다', async () => {
    const messages: LoadedMessage[] = Array.from({ length: 200_000 }, (_, index) => ({
      id: String(index),
      role: 'user',
      createdAt: index,
      parts: []
    }))
    const single = setup()
    const one = single.client.load('one')
    single.chunk(0, 0, messages)
    single.reply(0, head('one', 1, messages.length))
    const many = setup()
    const split = many.client.load('many')
    for (let seq = 0; seq < 400; seq++)
      many.chunk(0, seq, messages.slice(seq * 500, (seq + 1) * 500))
    many.reply(0, head('many', 400, messages.length))
    for (const loaded of [await one, await split]) {
      expect(loaded?.messages).toHaveLength(200_000)
      const order = loaded!.messages.map((item) => item.createdAt)
      expect(order.every((value, index) => value === index)).toBe(true)
    }
  })

  it('요청마다 번호를 싣고, 그 번호의 조각을 순서대로 한 벌로 조립한다', async () => {
    const h = setup()
    const loading = h.client.load('s1')
    expect(h.calls).toEqual([{ channel: 'load', payload: { sessionId: 's1', requestId: 0 } }])
    h.chunk(0, 0, [message('가'), message('나')])
    h.chunk(0, 1, [message('다')])
    h.reply(0, head('s1', 2, 3))
    const session = await loading
    expect(session).toEqual({
      id: 's1',
      backend: 'claude',
      agentKind: 'code',
      title: '제목-s1',
      messages: [message('가'), message('나'), message('다')]
    })
  })

  it('두 요청의 조각이 섞여 와도 번호대로 나눠 조립한다', async () => {
    const h = setup()
    const first = h.client.load('a')
    const second = h.client.load('b')
    h.chunk(1, 0, [message('b-0')])
    h.chunk(0, 0, [message('a-0')])
    h.reply(1, head('b', 1, 1))
    h.reply(0, head('a', 1, 1))
    expect((await first)?.messages).toEqual([message('a-0')])
    expect((await second)?.messages).toEqual([message('b-0')])
  })

  it('없는 세션(`null`)과 조각 없는 본문은 그대로 돌려준다', async () => {
    const h = setup()
    const missing = h.client.load('없음')
    h.reply(0, null)
    expect(await missing).toBeNull()
    const whole = h.client.load('통째')
    const plain: Record<string, unknown> = { ...head('통째', 0, 0) }
    delete plain.chunked
    h.reply(1, { ...plain, messages: [message('통째')] })
    expect((await whole)?.messages).toEqual([message('통째')])
  })

  it('조각이 빠진 응답은 거부한다 — 일부만 조립한 본문을 돌려주지 않는다', async () => {
    const h = setup()
    const loading = h.client.load('s1')
    h.chunk(0, 0, [message('가')])
    h.reply(0, head('s1', 2, 2))
    await expect(loading).rejects.toThrow('세션 조각 수가 다르다')
  })

  it('취소하면 번호를 실어 통지하고, 그 요청의 늦은 조각을 버리며, 다른 요청은 정상이다', async () => {
    const h = setup()
    const cancelled = h.client.load('a')
    const other = h.client.load('b')
    h.chunk(0, 0, [message('a-0')])
    h.client.cancelLoad('a')
    expect(h.sent).toEqual([['cancel', { requestId: 0 }]])
    // 늦은 조각 — 버린다.
    h.chunk(0, 1, [message('a-1')])
    // 호스트가 취소를 보기 전에 끝낸 응답이 와도 본문을 돌려주지 않는다.
    h.reply(0, head('a', 2, 2))
    await expect(cancelled).rejects.toThrow(SESSION_LOAD_CANCELLED)
    h.chunk(1, 0, [message('b-0')])
    h.reply(1, head('b', 1, 1))
    expect((await other)?.messages).toEqual([message('b-0')])
    // 같은 세션을 두 번 취소해도 통지는 한 번이다.
    h.client.cancelLoad('a')
    expect(h.sent).toHaveLength(1)
  })

  it('호스트가 취소로 답하면 거부한다', async () => {
    const h = setup()
    const loading = h.client.load('a')
    h.reply(0, { cancelled: true })
    await expect(loading).rejects.toThrow(SESSION_LOAD_CANCELLED)
  })

  it('갱신은 `updated` 의 본문만 조립하고 나머지 상태는 그대로다. 취소 대상이 아니다', async () => {
    const h = setup()
    const updated = h.client.refresh('s1')
    expect(h.calls[0]).toEqual({ channel: 'refresh', payload: { sessionId: 's1', requestId: 0 } })
    h.client.cancelLoad('s1')
    expect(h.sent).toEqual([])
    h.chunk(0, 0, [message('새')])
    h.reply(0, { status: 'updated', session: head('s1', 1, 1) })
    expect(await updated).toEqual({
      status: 'updated',
      session: expect.objectContaining({ id: 's1', messages: [message('새')] })
    })
    const busy = h.client.refresh('s1')
    h.reply(1, { status: 'busy' })
    expect(await busy).toEqual({ status: 'busy' })
  })

  it('끝난 요청의 번호로 온 조각은 다음 요청에 섞이지 않는다', async () => {
    const h = setup()
    const first = h.client.load('a')
    h.reply(0, null)
    await first
    const spy = vi.fn()
    h.chunk(0, 0, [message('늦음')])
    const second = h.client.load('a')
    h.chunk(1, 0, [message('둘째')])
    h.reply(1, head('a', 1, 1))
    void second.then(spy)
    expect((await second)?.messages).toEqual([message('둘째')])
  })
})

describe('bounded history page replies', () => {
  const ok = {
    status: 'ok',
    requestId: 0,
    openGeneration: 0,
    sessionId: 's',
    session: {
      id: 's',
      backend: 'claude',
      agentKind: 'code',
      title: null,
      complete: false,
      history: { generation: 'gen' },
      messages: [message('tail')]
    }
  }
  it('accepts one matching page and keeps refresh on the bounded path', async () => {
    const port = setup(true)
    const first = port.client.loadLatest('s')
    expect(port.calls[0]).toEqual({
      channel: 'history-page',
      payload: { sessionId: 's', kind: 'latest', openGeneration: 0, requestId: 0 }
    })
    port.reply(0, ok)
    expect(await first).toEqual(ok.session)
    const refresh = port.client.refresh('s')
    expect(port.calls[1].payload).toMatchObject({ requestId: 1, openGeneration: 1 })
    port.reply(1, { status: 'unchanged' })
    expect(await refresh).toEqual({ status: 'unchanged' })
  })
  it.each([
    { sessionId: 'other' },
    { requestId: 71 },
    { openGeneration: 72 },
    { status: 'unknown' },
    { session: { ...ok.session, messages: [message('tail'), message('tail')] } },
    { session: { ...ok.session, messages: [], history: null } }
  ])('rejects mismatched or incomplete replies %j', async (patch) => {
    const port = setup(true)
    const first = port.client.loadLatest('s')
    port.reply(0, { ...ok, ...patch })
    await expect(first).rejects.toThrow('Mismatched history reply')
  })
})
