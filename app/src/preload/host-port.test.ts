// 창 쪽 에이전트 호스트 포트 클라이언트 (0324 EP-8 · plan §7-E 규칙 칸 8분기).

import { describe, expect, it } from 'vitest'
import type { ClientToHost } from '../shared/host-protocol'
import {
  hostExitedError,
  hostReplacedError,
  createHostPortClient,
  type ClientPort
} from './host-port'

class FakePort implements ClientPort {
  readonly sent: ClientToHost[] = []
  closed = 0
  private listener: ((data: unknown) => void) | null = null
  postMessage(message: ClientToHost): void {
    this.sent.push(message)
  }
  onMessage(listener: (data: unknown) => void): void {
    this.listener = listener
  }
  close(): void {
    this.closed += 1
  }
  reply(data: unknown): void {
    this.listener?.(data)
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await Promise.resolve()
}

function setup(): { client: ReturnType<typeof createHostPortClient>; connects: () => number } {
  let connects = 0
  const client = createHostPortClient({ host: 'agent', requestConnect: () => (connects += 1) })
  return { client, connects: () => connects }
}

// 결과를 기록해 두어 처리 안 된 거부가 나지 않게 한다.
function track(promise: Promise<unknown>): { state: () => string } {
  let state = 'pending'
  promise.then(
    (value) => (state = `ok:${JSON.stringify(value)}`),
    (error: Error) => (state = `err:${error.message}`)
  )
  return { state: () => state }
}

describe('createHostPortClient — 포트가 있을 때', () => {
  it('요청은 그 포트로 1건 가고, ok 응답이면 값으로 풀린다', async () => {
    const { client } = setup()
    const port = new FakePort()
    client.attachPort(port)
    const result = track(client.invoke('oo:a', { x: 1 }))
    expect(port.sent).toEqual([{ kind: 'invoke', id: 0, channel: 'oo:a', payload: { x: 1 } }])
    port.reply({ kind: 'result', id: 0, ok: true, value: 42 })
    await flush()
    expect(result.state()).toBe('ok:42')
  })

  it('ok:false 응답이면 그 오류 문장으로 거부한다', async () => {
    const { client } = setup()
    const port = new FakePort()
    client.attachPort(port)
    const result = track(client.invoke('oo:a'))
    port.reply({ kind: 'result', id: 0, ok: false, error: 'Error: 안 됨' })
    await flush()
    expect(result.state()).toBe('err:Error: 안 됨')
  })

  it('요청마다 번호가 다르고 응답은 번호로 짝짓는다', async () => {
    const { client } = setup()
    const port = new FakePort()
    client.attachPort(port)
    const first = track(client.invoke('oo:a'))
    const second = track(client.invoke('oo:b'))
    expect(port.sent.map((m) => (m.kind === 'invoke' ? m.id : -1))).toEqual([0, 1])
    port.reply({ kind: 'result', id: 1, ok: true, value: 'b' })
    await flush()
    expect(first.state()).toBe('pending')
    expect(second.state()).toBe('ok:"b"')
  })

  it('단방향 송신은 send 메시지 1건이다', () => {
    const { client } = setup()
    const port = new FakePort()
    client.attachPort(port)
    client.send('oo:log', { level: 'info' })
    expect(port.sent).toEqual([{ kind: 'send', channel: 'oo:log', payload: { level: 'info' } }])
  })
})

describe('createHostPortClient — 포트가 없을 때', () => {
  it('첫 포트 전의 요청·송신은 줄을 섰다가 들어온 순서대로 보낸다 — 연결 요청 없음', async () => {
    const { client, connects } = setup()
    const result = track(client.invoke('oo:a', 1))
    client.send('oo:b', 2)
    track(client.invoke('oo:c', 3))
    await flush()
    expect(result.state()).toBe('pending')
    expect(connects()).toBe(0)
    const port = new FakePort()
    client.attachPort(port)
    expect(port.sent).toEqual([
      { kind: 'invoke', id: 0, channel: 'oo:a', payload: 1 },
      { kind: 'send', channel: 'oo:b', payload: 2 },
      { kind: 'invoke', id: 1, channel: 'oo:c', payload: 3 }
    ])
    port.reply({ kind: 'result', id: 0, ok: true, value: 'a' })
    await flush()
    expect(result.state()).toBe('ok:"a"')
  })

  it('종료 통지는 응답 대기와 대기열을 모두 거부하고 포트를 닫는다', async () => {
    const { client } = setup()
    const queued = track(client.invoke('oo:queued'))
    const port = new FakePort()
    client.attachPort(port)
    const inFlight = track(client.invoke('oo:a'))
    client.hostExited()
    const afterExit = track(client.invoke('oo:b'))
    client.hostExited()
    await flush()
    expect(queued.state()).toBe(`err:${hostExitedError('agent')}`)
    expect(inFlight.state()).toBe(`err:${hostExitedError('agent')}`)
    expect(afterExit.state()).toBe(`err:${hostExitedError('agent')}`)
    expect(port.closed).toBe(1)
  })

  it('첫 포트 전의 대기열도 종료 통지가 거부한다', async () => {
    const { client } = setup()
    const queued = track(client.invoke('oo:a'))
    client.hostExited()
    await flush()
    expect(queued.state()).toBe(`err:${hostExitedError('agent')}`)
    const port = new FakePort()
    client.attachPort(port)
    expect(port.sent).toEqual([])
  })

  it('종료 뒤 첫 요청이 연결 요청을 1회 보내고, 둘째 요청은 더 보내지 않는다', () => {
    const { client, connects } = setup()
    client.attachPort(new FakePort())
    client.hostExited()
    expect(connects()).toBe(0)
    track(client.invoke('oo:a'))
    expect(connects()).toBe(1)
    client.send('oo:b')
    track(client.invoke('oo:c'))
    expect(connects()).toBe(1)
  })

  it('종료 뒤 송신도 연결을 부른다', () => {
    const { client, connects } = setup()
    client.hostExited()
    client.send('oo:b')
    expect(connects()).toBe(1)
  })

  it('다시 연결되고 또 죽으면 다음 요청이 연결을 다시 부른다', () => {
    const { client, connects } = setup()
    client.hostExited()
    track(client.invoke('oo:a'))
    client.attachPort(new FakePort())
    client.hostExited()
    track(client.invoke('oo:b'))
    expect(connects()).toBe(2)
  })

  it('연결 요청 뒤 포트가 오기 전에 또 죽으면 다음 요청이 연결을 다시 부른다', () => {
    const { client, connects } = setup()
    client.hostExited()
    track(client.invoke('oo:a'))
    client.hostExited()
    track(client.invoke('oo:b'))
    expect(connects()).toBe(2)
  })

  it('새 포트가 오면 연결 요청 상태가 풀려 그 포트로 바로 보낸다', () => {
    const { client, connects } = setup()
    client.hostExited()
    track(client.invoke('oo:a'))
    const port = new FakePort()
    client.attachPort(port)
    track(client.invoke('oo:b'))
    expect(connects()).toBe(1)
    expect(port.sent.map((m) => m.channel)).toEqual(['oo:a', 'oo:b'])
  })
})

describe('createHostPortClient — 포트 교체', () => {
  it('옛 포트에서 기다리던 요청을 거부하고 옛 포트를 닫는다 · 이후 요청은 새 포트로 (AC33)', async () => {
    const { client } = setup()
    const first = new FakePort()
    client.attachPort(first)
    const pending = track(client.invoke('oo:a'))
    const second = new FakePort()
    client.attachPort(second)
    track(client.invoke('oo:b'))
    await flush()
    expect(pending.state()).toBe(`err:${hostReplacedError('agent')}`)
    expect(first.closed).toBe(1)
    expect(second.closed).toBe(0)
    expect(first.sent.map((m) => m.channel)).toEqual(['oo:a'])
    expect(second.sent.map((m) => m.channel)).toEqual(['oo:b'])
  })

  it('첫 포트에 보낸 대기열은 교체한 포트에 다시 보내지 않는다', () => {
    const { client } = setup()
    track(client.invoke('oo:queued'))
    client.attachPort(new FakePort())
    const second = new FakePort()
    client.attachPort(second)
    expect(second.sent).toEqual([])
  })

  it('옛 포트의 늦은 응답·통지는 무시한다', async () => {
    const { client } = setup()
    const first = new FakePort()
    client.attachPort(first)
    const seen: unknown[] = []
    client.on('oo:evt', (payload) => seen.push(payload))
    const second = new FakePort()
    client.attachPort(second)
    const fresh = track(client.invoke('oo:b'))
    first.reply({ kind: 'result', id: 1, ok: true, value: 'stale' })
    first.reply({ kind: 'event', channel: 'oo:evt', payload: 'stale' })
    await flush()
    expect(fresh.state()).toBe('pending')
    expect(seen).toEqual([])
  })
})

describe('createHostPortClient — 통지', () => {
  it('그 채널의 구독자 전부에 전달하고, 해제한 구독자는 받지 않는다', () => {
    const { client } = setup()
    const port = new FakePort()
    client.attachPort(port)
    const a: unknown[] = []
    const b: unknown[] = []
    const other: unknown[] = []
    const offA = client.on('oo:evt', (payload) => a.push(payload))
    client.on('oo:evt', (payload) => b.push(payload))
    client.on('oo:other', (payload) => other.push(payload))
    port.reply({ kind: 'event', channel: 'oo:evt', payload: 1 })
    offA()
    port.reply({ kind: 'event', channel: 'oo:evt', payload: 2 })
    expect(a).toEqual([1])
    expect(b).toEqual([1, 2])
    expect(other).toEqual([])
  })

  it('포트를 바꿔도 구독은 유지된다', () => {
    const { client } = setup()
    const seen: unknown[] = []
    client.on('oo:evt', (payload) => seen.push(payload))
    client.attachPort(new FakePort())
    client.hostExited()
    const next = new FakePort()
    client.attachPort(next)
    next.reply({ kind: 'event', channel: 'oo:evt', payload: 'again' })
    expect(seen).toEqual(['again'])
  })

  it('형식이 틀린 메시지와 모르는 요청 번호는 무시한다', async () => {
    const { client } = setup()
    const port = new FakePort()
    client.attachPort(port)
    const result = track(client.invoke('oo:a'))
    port.reply({ kind: 'result', id: 0, ok: 'yes' })
    port.reply(null)
    port.reply({ kind: 'result', id: 7, ok: true, value: 'x' })
    await flush()
    expect(result.state()).toBe('pending')
    port.reply({ kind: 'result', id: 0, ok: true, value: 'real' })
    port.reply({ kind: 'result', id: 0, ok: true, value: 'twice' })
    await flush()
    expect(result.state()).toBe('ok:"real"')
  })

  it('데이터 호스트 포트의 실패 문장은 데이터 호스트를 가리킨다', () => {
    expect(hostExitedError('data')).toBe('데이터 호스트가 종료됐다')
    expect(hostReplacedError('data')).toBe('데이터 호스트가 다시 연결됐다')
    expect(hostExitedError('agent')).toBe('에이전트 호스트가 종료됐다')
  })
})
