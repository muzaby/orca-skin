// 피어 포트의 양 끝 (0324 AR-13 · EP-21 규칙 칸 5분기 · EP-2′ · AC44 · AC48).
// 포트 1쌍을 메모리로 잇고 두 링크를 실제로 마주 세운다.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PeerMessage } from '../../../shared/peer-protocol'
import {
  createPeerLink,
  PEER_CLOSED_ERROR,
  PEER_UNAVAILABLE_ERROR,
  type PeerPort
} from './peer-link'
import * as stall from '../perf/stall-monitor'

class MemoryPort implements PeerPort {
  other: MemoryPort | null = null
  closed = false
  readonly sent: PeerMessage[] = []
  private messageListener: ((data: unknown) => void) | null = null
  private closeListener: (() => void) | null = null
  post(message: PeerMessage): void {
    this.sent.push(message)
    if (!this.closed) this.other?.messageListener?.(structuredClone(message))
  }
  // 반대편이 보낸 것처럼 날 데이터를 넣는다.
  inject(data: unknown): void {
    this.messageListener?.(data)
  }
  onMessage(listener: (data: unknown) => void): void {
    this.messageListener = listener
  }
  onClose(listener: () => void): void {
    this.closeListener = listener
  }
  started = 0
  start(): void {
    this.started += 1
  }
  close(): void {
    if (this.closed) return
    this.closed = true
    this.closeListener?.()
    const other = this.other
    if (other && !other.closed) other.close()
  }
}

function pair(): [MemoryPort, MemoryPort] {
  const a = new MemoryPort()
  const b = new MemoryPort()
  a.other = b
  b.other = a
  return [a, b]
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createPeerLink', () => {
  it('요청은 반대편 핸들러의 값으로 풀리고, 던지면 그 문장으로 거부된다', async () => {
    const agent = createPeerLink({ side: 'agent', onRequest: () => null, onNotify: () => {} })
    const data = createPeerLink({
      side: 'data',
      onRequest: (method, payload) => {
        if ((payload as { fail?: boolean }).fail) throw new Error('저장 실패')
        return { method, id: 7 }
      },
      onNotify: () => {}
    })
    const [a, b] = pair()
    agent.attach(a)
    data.attach(b)
    await expect(agent.request('turn.commitUser', {})).resolves.toEqual({
      method: 'turn.commitUser',
      id: 7
    })
    await expect(agent.request('turn.commitUser', { fail: true })).rejects.toThrow('저장 실패')
  })

  it('통지는 도착 순서대로 그 자리에서 처리된다 (F1 저장 순서)', () => {
    const seen: string[] = []
    const agent = createPeerLink({ side: 'agent', onRequest: () => null, onNotify: () => {} })
    const data = createPeerLink({
      side: 'data',
      onRequest: () => null,
      onNotify: (method, payload) => seen.push(`${method}:${(payload as { n: number }).n}`)
    })
    const [a, b] = pair()
    agent.attach(a)
    data.attach(b)
    agent.notify('turn.begin', { n: 1 })
    agent.notify('turn.event', { n: 2 })
    agent.notify('turn.event', { n: 3 })
    agent.notify('turn.end', { n: 4 })
    expect(seen).toEqual(['turn.begin:1', 'turn.event:2', 'turn.event:3', 'turn.end:4'])
  })

  it('반대편 방향의 메서드·틀린 봉투는 거부하고, 요청이면 실패로 답한다', () => {
    const invalid: string[] = []
    const onNotify = vi.fn()
    const data = createPeerLink({
      side: 'data',
      onRequest: () => null,
      onNotify,
      onInvalid: () => invalid.push('x')
    })
    const [a, b] = pair()
    data.attach(b)
    // 데이터 호스트가 보내는 메서드를 에이전트가 보낸 척한다.
    b.inject({ kind: 'notify', method: 'settings.patch', payload: {} })
    b.inject({ kind: 'request', id: 3, method: 'agent.call', payload: {} })
    b.inject({ kind: 'notify', method: 'unknown.method' })
    expect(onNotify).not.toHaveBeenCalled()
    expect(invalid).toHaveLength(3)
    expect(b.sent).toEqual([{ kind: 'result', id: 3, ok: false, error: '형식이 틀린 요청' }])
    expect(a.sent).toEqual([])
  })

  it('포트가 닫히면 응답을 기다리던 요청이 모두 실패하고 닫힘 구독자에게 알린다 (AC44)', async () => {
    const agent = createPeerLink({ side: 'agent', onRequest: () => null, onNotify: () => {} })
    const data = createPeerLink({
      side: 'data',
      onRequest: () => new Promise(() => {}),
      onNotify: () => {}
    })
    const closed = vi.fn()
    agent.onClosed(closed)
    const [a, b] = pair()
    agent.attach(a)
    data.attach(b)
    const first = agent.request('turn.commitUser', {})
    const second = agent.request('provider.event', {})
    b.close()
    await expect(first).rejects.toThrow(PEER_CLOSED_ERROR)
    await expect(second).rejects.toThrow(PEER_CLOSED_ERROR)
    expect(closed).toHaveBeenCalledTimes(1)
    expect(agent.connected()).toBe(false)
    expect(agent.notify('turn.event', {})).toBe(false)
    await expect(agent.request('turn.commitUser', {})).rejects.toThrow(PEER_CLOSED_ERROR)
  })

  describe('requestEnsured (EP-21)', () => {
    it('연결됨 — 바로 보내고 ensure 0', async () => {
      const ensure = vi.fn()
      const data = createPeerLink({
        side: 'data',
        onRequest: () => null,
        onNotify: () => {},
        ensure
      })
      const agent = createPeerLink({ side: 'agent', onRequest: () => 'ok', onNotify: () => {} })
      const [a, b] = pair()
      data.attach(a)
      agent.attach(b)
      await expect(data.requestEnsured('agent.call', { op: 'x', args: [] })).resolves.toBe('ok')
      expect(ensure).not.toHaveBeenCalled()
    })

    it('미연결 — ensure 1 + 대기, 둘째 요청은 ensure 를 더 보내지 않고 연결되면 들어온 차례대로 간다', async () => {
      const ensure = vi.fn()
      const order: string[] = []
      const data = createPeerLink({
        side: 'data',
        onRequest: () => null,
        onNotify: () => {},
        ensure
      })
      const first = data.requestEnsured('agent.call', { op: 'first', args: [] })
      const second = data.requestEnsured('agent.call', { op: 'second', args: [] })
      expect(ensure).toHaveBeenCalledTimes(1)
      const agent = createPeerLink({
        side: 'agent',
        onRequest: (_method, payload) => {
          const { op } = payload as { op: string }
          order.push(op)
          return op
        },
        onNotify: () => {}
      })
      const [a, b] = pair()
      agent.attach(b)
      data.attach(a)
      await expect(first).resolves.toBe('first')
      await expect(second).resolves.toBe('second')
      expect(order).toEqual(['first', 'second'])
    })

    it('대기 중 unavailable — 기다리던 요청을 모두 거부하고, 다음 요청은 다시 ensure 한다', async () => {
      const ensure = vi.fn()
      const data = createPeerLink({
        side: 'data',
        onRequest: () => null,
        onNotify: () => {},
        ensure
      })
      const first = data.requestEnsured('agent.call', { op: 'a', args: [] })
      const second = data.requestEnsured('agent.call', { op: 'b', args: [] })
      data.unavailable()
      await expect(first).rejects.toThrow(PEER_UNAVAILABLE_ERROR)
      await expect(second).rejects.toThrow(PEER_UNAVAILABLE_ERROR)
      void data.requestEnsured('agent.call', { op: 'c', args: [] }).catch(() => {})
      expect(ensure).toHaveBeenCalledTimes(2)
    })

    it('미연결 + 확보 안 함 — request 는 즉시 거부하고 ensure 0', async () => {
      const ensure = vi.fn()
      const data = createPeerLink({
        side: 'data',
        onRequest: () => null,
        onNotify: () => {},
        ensure
      })
      await expect(data.request('agent.call', { op: 'activity', args: [] })).rejects.toThrow(
        PEER_CLOSED_ERROR
      )
      expect(ensure).not.toHaveBeenCalled()
    })
  })

  it('새 포트가 오면 옛 포트를 닫고 그 요청을 실패시킨다 (피어 재연결)', async () => {
    const agent = createPeerLink({ side: 'agent', onRequest: () => null, onNotify: () => {} })
    const data = createPeerLink({
      side: 'data',
      onRequest: () => new Promise(() => {}),
      onNotify: () => {}
    })
    const [a1, b1] = pair()
    agent.attach(a1)
    data.attach(b1)
    const pending = agent.request('turn.commitUser', {})
    const [a2] = pair()
    agent.attach(a2)
    await expect(pending).rejects.toThrow(PEER_CLOSED_ERROR)
    expect(a1.closed).toBe(true)
    expect(agent.connected()).toBe(true)
  })

  it('받은 메시지 처리의 동기 구간을 메서드 이름과 함께 perf.stall 로 잰다 (D-043 · AC6′)', async () => {
    const record = vi.spyOn(stall, 'recordStall').mockImplementation(() => {})
    let now = 0
    const data = createPeerLink({
      side: 'data',
      clock: () => now,
      onRequest: () => {
        now += 60
        return null
      },
      onNotify: () => {
        now += 70
      }
    })
    const agent = createPeerLink({ side: 'agent', onRequest: () => null, onNotify: () => {} })
    const [a, b] = pair()
    agent.attach(a)
    data.attach(b)
    agent.notify('turn.event', {})
    await agent.request('turn.commitUser', {})
    await flush()
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'peer', label: 'turn.event', durationMs: 70 })
    )
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'peer', label: 'turn.commitUser', durationMs: 60 })
    )
  })
})
