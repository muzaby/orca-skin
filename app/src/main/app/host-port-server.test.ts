import { describe, expect, it, vi } from 'vitest'
import type { HostToClient } from '../../shared/host-protocol'
import { createPortTransport, type HostPort } from './host-port-server'

interface FakePort extends HostPort {
  readonly posted: HostToClient[]
  readonly state: { started: boolean; closed: number }
  receive(data: unknown): void
  // 상대 쪽이 닫았다.
  drop(): void
}

function fakePort(): FakePort {
  const posted: HostToClient[] = []
  const state = { started: false, closed: 0 }
  let onMessage: (data: unknown) => void = () => {}
  let onClose: () => void = () => {}
  return {
    posted,
    state,
    post: (message) => posted.push(message),
    onMessage: (listener) => (onMessage = listener),
    onClose: (listener) => (onClose = listener),
    start: () => (state.started = true),
    close: () => (state.closed += 1),
    receive: (data) => onMessage(data),
    drop: () => onClose()
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('에이전트 호스트 포트 전송', () => {
  it('요청을 등록된 핸들러에 넘기고 같은 번호로 답한다', async () => {
    const transport = createPortTransport()
    transport.handle('oo:a', (_event, raw) => ({ echoed: raw }))
    const port = fakePort()
    transport.connect(port, { clientId: 7, trusted: true })
    expect(port.state.started).toBe(true)

    port.receive({ kind: 'invoke', id: 3, channel: 'oo:a', payload: { n: 1 } })
    await settle()

    expect(port.posted).toEqual([{ kind: 'result', id: 3, ok: true, value: { echoed: { n: 1 } } }])
  })

  it('핸들러가 던지거나 reject 하면 오류 응답이다', async () => {
    const transport = createPortTransport()
    transport.handle('oo:throw', () => {
      throw new TypeError('동기 실패')
    })
    transport.handle('oo:reject', () => Promise.reject(new Error('비동기 실패')))
    const port = fakePort()
    transport.connect(port, { clientId: 1, trusted: true })

    port.receive({ kind: 'invoke', id: 1, channel: 'oo:throw' })
    port.receive({ kind: 'invoke', id: 2, channel: 'oo:reject' })
    await settle()

    expect(port.posted).toEqual([
      { kind: 'result', id: 1, ok: false, error: 'TypeError: 동기 실패' },
      { kind: 'result', id: 2, ok: false, error: 'Error: 비동기 실패' }
    ])
  })

  it('연결의 신뢰 판정이 요청 이벤트에 실린다 — 요청이 바꿀 수 없다', async () => {
    const transport = createPortTransport()
    const seen: Array<{ id: number; trusted: boolean }> = []
    transport.handle('oo:a', (event) => {
      seen.push({ id: event.sender.id, trusted: event.trusted })
    })
    const trusted = fakePort()
    const untrusted = fakePort()
    transport.connect(trusted, { clientId: 1, trusted: true })
    transport.connect(untrusted, { clientId: 2, trusted: false })

    trusted.receive({ kind: 'invoke', id: 0, channel: 'oo:a' })
    untrusted.receive({
      kind: 'invoke',
      id: 0,
      channel: 'oo:a',
      trusted: true,
      payload: { trusted: true }
    })
    await settle()

    expect(seen).toEqual([
      { id: 1, trusted: true },
      { id: 2, trusted: false }
    ])
  })

  it('같은 창이 다시 연결되면 옛 참조를 닫고 새 참조가 요청을 받는다', async () => {
    const transport = createPortTransport()
    const senders: unknown[] = []
    transport.handle('oo:a', (event) => {
      senders.push(event.sender)
    })
    const first = fakePort()
    const second = fakePort()
    const oldRef = transport.connect(first, { clientId: 4, trusted: true })
    const closed = vi.fn()
    oldRef.onClosed(closed)

    const newRef = transport.connect(second, { clientId: 4, trusted: true })

    expect(closed).toHaveBeenCalledTimes(1)
    expect(oldRef.isClosed()).toBe(true)
    expect(first.state.closed).toBe(1)
    expect(transport.clients()).toEqual([newRef])

    oldRef.send('oo:event', 1)
    first.receive({ kind: 'invoke', id: 0, channel: 'oo:a' })
    second.receive({ kind: 'invoke', id: 0, channel: 'oo:a' })
    await settle()
    expect(first.posted).toEqual([])
    expect(senders).toEqual([newRef])
  })

  it('포트가 닫히면 닫힘을 한 번 알리고 그 참조로 보내지 않는다', () => {
    const transport = createPortTransport()
    const port = fakePort()
    const ref = transport.connect(port, { clientId: 1, trusted: true })
    const closed = vi.fn()
    ref.onClosed(closed)

    ref.send('oo:event', { before: true })
    port.drop()
    port.drop()
    ref.send('oo:event', { after: true })

    expect(closed).toHaveBeenCalledTimes(1)
    expect(port.posted).toEqual([{ kind: 'event', channel: 'oo:event', payload: { before: true } }])
    expect(transport.clients()).toEqual([])
    expect(transport.primaryClient()).toBeUndefined()
  })

  it('옛 포트가 늦게 닫혀도 같은 창의 새 참조는 남는다', () => {
    const transport = createPortTransport()
    const first = fakePort()
    const second = fakePort()
    transport.connect(first, { clientId: 4, trusted: true })
    const newRef = transport.connect(second, { clientId: 4, trusted: true })

    first.drop()

    expect(newRef.isClosed()).toBe(false)
    expect(transport.clients()).toEqual([newRef])
  })

  it('형식이 틀린 요청과 등록 안 된 채널은 오류 응답이고 핸들러를 부르지 않는다', async () => {
    const transport = createPortTransport()
    const handler = vi.fn()
    transport.handle('oo:a', handler)
    const port = fakePort()
    transport.connect(port, { clientId: 1, trusted: true })

    port.receive({ kind: 'invoke', id: 5, channel: '' })
    port.receive({ kind: 'invoke', id: 6, channel: 'oo:none' })
    port.receive('쓰레기')
    port.receive(null)
    await settle()

    expect(handler).not.toHaveBeenCalled()
    expect(port.posted).toEqual([
      { kind: 'result', id: 5, ok: false, error: '형식이 틀린 요청' },
      { kind: 'result', id: 6, ok: false, error: "No handler registered for 'oo:none'" }
    ])
  })

  it('단방향 송신은 그 채널의 수신자 전부에 가고 답하지 않는다', () => {
    const transport = createPortTransport()
    const a = vi.fn()
    const b = vi.fn()
    const other = vi.fn()
    transport.on('oo:log', a)
    transport.on('oo:log', b)
    transport.on('oo:other', other)
    const port = fakePort()
    const ref = transport.connect(port, { clientId: 1, trusted: false })

    port.receive({ kind: 'send', channel: 'oo:log', payload: 'x' })

    expect(a).toHaveBeenCalledWith({ sender: ref, trusted: false }, 'x')
    expect(b).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
    expect(port.posted).toEqual([])
  })

  it('같은 채널에 요청 핸들러를 두 번 등록하면 던진다', () => {
    const transport = createPortTransport()
    transport.handle('oo:a', () => 1)
    expect(() => transport.handle('oo:a', () => 2)).toThrow(/second handler/)
  })

  it('방송 대상은 연결 순서이고 먼저 연결된 창이 대표다', () => {
    const transport = createPortTransport()
    const one = transport.connect(fakePort(), { clientId: 9, trusted: true })
    const two = transport.connect(fakePort(), { clientId: 2, trusted: true })
    expect(transport.clients()).toEqual([one, two])
    expect(transport.primaryClient()).toBe(one)
  })
})
