import { describe, expect, it, vi } from 'vitest'
import { createOpDispatcher, createRemoteOps, unknownOpError } from './peer-ops'
import { createPeerLoopback } from './peer-loopback'
import { createPeerLink } from './peer-link'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('피어 연산 표', () => {
  it('표에 있는 이름을 인자와 함께 실행하고 결과를 돌려준다', () => {
    const add = vi.fn((a: number, b: number) => a + b)
    expect(createOpDispatcher({ add })({ op: 'add', args: [2, 5] })).toBe(7)
    expect(add).toHaveBeenCalledExactlyOnceWith(2, 5)
  })

  it('표에 없는 이름·상속된 이름은 실행하지 않고 던진다', () => {
    const dispatch = createOpDispatcher({ add: (a: number) => a })
    expect(() => dispatch({ op: 'drop', args: [] })).toThrow(unknownOpError('drop'))
    expect(() => dispatch({ op: 'constructor', args: [] })).toThrow(unknownOpError('constructor'))
    expect(() => dispatch({ op: 'toString', args: [] })).toThrow(unknownOpError('toString'))
  })

  it('봉투 형식이 틀리면 표를 보기 전에 던진다', () => {
    const add = vi.fn()
    const dispatch = createOpDispatcher({ add })
    expect(() => dispatch({ op: 'add' })).toThrow()
    expect(() => dispatch({ op: '', args: [] })).toThrow()
    expect(() => dispatch('add')).toThrow()
    expect(add).not.toHaveBeenCalled()
  })

  it('보내는 쪽 — 이름과 인자를 봉투로 바꾼다. thenable 로 오인되지 않는다', async () => {
    const send = vi.fn().mockResolvedValue('row')
    const ops = createRemoteOps<{ find(id: string, deep: boolean): string }>(send)
    await expect(ops.find('s1', true)).resolves.toBe('row')
    expect(send).toHaveBeenCalledExactlyOnceWith({ op: 'find', args: ['s1', true] })
    expect((ops as unknown as { then?: unknown }).then).toBeUndefined()
  })
})

describe('피어 루프백', () => {
  it('두 링크를 이어 요청·응답이 건너가고, 값은 복제된다', async () => {
    const row = { id: 's1', nested: { n: 1 } }
    const data = createPeerLink({
      side: 'data',
      onRequest: () => row,
      onNotify: () => {}
    })
    const agent = createPeerLink({ side: 'agent', onRequest: () => undefined, onNotify: () => {} })
    const ports = createPeerLoopback()
    data.attach(ports.data)
    agent.attach(ports.agent)
    const received = await agent.request('data.query', { op: 'x', args: [] })
    expect(received).toEqual(row)
    expect(received).not.toBe(row)
  })

  it('보낸 차례대로, 다음 마이크로태스크에 전달한다', async () => {
    const seen: unknown[] = []
    const data = createPeerLink({
      side: 'data',
      onRequest: () => undefined,
      onNotify: (_method, payload) => seen.push(payload)
    })
    const agent = createPeerLink({ side: 'agent', onRequest: () => undefined, onNotify: () => {} })
    const ports = createPeerLoopback()
    data.attach(ports.data)
    agent.attach(ports.agent)
    agent.notify('turn.event', 1)
    agent.notify('turn.event', 2)
    agent.notify('turn.end', 3)
    expect(seen).toEqual([])
    await flush()
    expect(seen).toEqual([1, 2, 3])
  })

  it('복제할 수 없는 값은 보내는 자리에서 던진다', () => {
    const agent = createPeerLink({ side: 'agent', onRequest: () => undefined, onNotify: () => {} })
    const ports = createPeerLoopback()
    agent.attach(ports.agent)
    expect(() => agent.notify('turn.event', { run: () => 1 })).toThrow()
  })

  it('한쪽을 닫으면 반대편의 닫힘 구독자가 불리고 기다리던 요청이 실패한다', async () => {
    const data = createPeerLink({
      side: 'data',
      onRequest: () => new Promise(() => {}),
      onNotify: () => {}
    })
    const agent = createPeerLink({ side: 'agent', onRequest: () => undefined, onNotify: () => {} })
    const ports = createPeerLoopback()
    data.attach(ports.data)
    agent.attach(ports.agent)
    const closed = vi.fn()
    agent.onClosed(closed)
    const pending = agent.request('data.query', { op: 'x', args: [] })
    await flush()
    data.close()
    await expect(pending).rejects.toThrow()
    expect(closed).toHaveBeenCalledTimes(1)
    expect(agent.connected()).toBe(false)
  })
})
