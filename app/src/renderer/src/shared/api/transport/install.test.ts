// `window.oo` 설치 — 다리 · 포트 수신 · 연결 순서 · 수명 통지 · 재연결 요청 (0324 EP-27 규칙 칸 · EP-29 ① ·
// AC52 · AC53 · AC29′·AC33′). 흉내 창(`message` 이벤트 대상 · `oo` · `ooBridge` 자리)과 흉내 다리를 쓰고,
// 포트는 Node `MessageChannel` 이다 — 설치가 감싼 포트로 실제 메시지가 오간다.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageChannel, type MessagePort as NodeMessagePort } from 'node:worker_threads'
import { CHANNELS } from '../../../../../shared/ipc'
import { HOST_PORT_MESSAGE } from '../../../../../shared/host-channels'
import type { OoBridge } from '../../../../../preload/index'
import { installOo, type OoWindow } from './install'
import type { HostLifecycleEvent, OoApi } from './oo'

// 지금 preload 가 노출하던 `oo` 의 최상위 묶음 — 형상 그대로여야 한다(D-058). 표에서 읽지 않고 고정한다.
const OO_GROUPS = [
  'error',
  'hosts',
  'boot',
  'chat',
  'backend',
  'harness',
  'agent',
  'engine',
  'install',
  'settings',
  'skills',
  'artifacts',
  'files',
  'git',
  'session',
  'project',
  'schedule',
  'window',
  'search',
  'mcp',
  'cost',
  'provider',
  'concurrency',
  'permission',
  'debug',
  'notify',
  'update',
  'log',
  'platform'
]

const opened: NodeMessagePort[] = []
afterEach(() => {
  for (const port of opened.splice(0)) port.close()
})

interface Fixture {
  win: OoWindow
  bridge: OoBridge
  // 설치가 부른 순서 — 수신 등록과 연결 요청.
  calls: string[]
  connect: ReturnType<typeof vi.fn>
  // 다리의 종료 통지를 흉내 낸다.
  exit(host: 'agent' | 'data'): void
  // 이 창의 `message` 이벤트를 보낸다.
  post(event: Partial<MessageEvent> & { data?: unknown }): void
}

function fixture(): Fixture {
  const calls: string[] = []
  const listeners: Array<(event: MessageEvent) => void> = []
  const exited = new Set<(host: 'agent' | 'data') => void>()
  const connect = vi.fn((host: string) => calls.push(`connectHost:${host}`))
  const bridge: OoBridge = {
    invoke: vi.fn(async () => undefined),
    send: vi.fn(),
    on: vi.fn(() => () => {}),
    connectHost: connect,
    onHostExited: (handler) => {
      exited.add(handler)
      return () => exited.delete(handler)
    },
    pathForFile: () => '/f',
    // 기본값·변이 고정값과 구별되는 값(0265 — 운반 값).
    platform: 'darwin'
  }
  const win: OoWindow = {
    ooBridge: bridge,
    addEventListener: (type, listener) => {
      calls.push(`addEventListener:${type}`)
      listeners.push(listener)
    }
  }
  return {
    win,
    bridge,
    calls,
    connect,
    exit: (host) => {
      for (const handler of [...exited]) handler(host)
    },
    post: (event) => {
      for (const listener of listeners) listener({ ports: [], ...event } as unknown as MessageEvent)
    }
  }
}

// 호스트 쪽 포트 끝 — 받은 요청을 기록하고 `value` 로 답한다. 창 쪽 끝이 닫히면 `closed()` 가 참이다(0324
// EP-27′ ⑥ — 설치가 감싼 실제 포트의 닫기를 짝 끝에서 본다).
function hostPort(value: unknown = 'ok'): {
  page: NodeMessagePort
  received: Array<{ channel: string }>
  closed(): boolean
} {
  const { port1, port2 } = new MessageChannel()
  opened.push(port1, port2)
  const received: Array<{ channel: string }> = []
  let closed = false
  port2.on('close', () => {
    closed = true
  })
  port2.on('message', (message: { kind: string; id: number; channel: string }) => {
    received.push(message)
    if (message.kind === 'invoke')
      port2.postMessage({ kind: 'result', id: message.id, ok: true, value })
  })
  return { page: port1, received, closed: () => closed }
}

const portMessage = (
  f: Fixture,
  host: unknown,
  ports: unknown[]
): Partial<MessageEvent> & { data: unknown } => ({
  source: f.win as unknown as MessageEventSource,
  data: { type: HOST_PORT_MESSAGE, host },
  ports: ports as MessagePort[]
})

describe('installOo — ① 다리', () => {
  it('다리가 있으면 그 위에 지금과 같은 형상의 `window.oo` 를 만든다', () => {
    const f = fixture()
    expect(installOo(f.win)).toBe('installed')
    expect(Object.keys(f.win.oo!)).toEqual(OO_GROUPS)
    expect(f.win.oo!.platform).toBe('darwin')
  })

  it('`window.oo` 가 이미 있으면 그대로 두고 다리를 부르지 않는다', () => {
    const f = fixture()
    const existing = { marker: true } as unknown as OoApi
    f.win.oo = existing
    expect(installOo(f.win)).toBe('present')
    expect(f.win.oo).toBe(existing)
    expect(f.calls).toEqual([])
  })

  it('다리가 없으면 아무것도 하지 않는다 — `missing` (EP-29 ①)', () => {
    const f = fixture()
    delete f.win.ooBridge
    expect(installOo(f.win)).toBe('missing')
    expect(f.win.oo).toBeUndefined()
    expect(f.calls).toEqual([])
  })
})

describe('installOo — ② 포트 수신', () => {
  it('이 창이 보낸 에이전트 포트 하나를 받으면 에이전트 채널 요청이 그 포트로 간다', async () => {
    const f = fixture()
    installOo(f.win)
    const agent = hostPort('agents')
    f.post(portMessage(f, 'agent', [agent.page]))
    expect(await f.win.oo!.agent.list()).toBe('agents')
    expect(agent.received.map((m) => m.channel)).toEqual([CHANNELS.agentList])
  })

  it.each([
    [
      '다른 창이 보냈다',
      (f: Fixture, port: unknown) => ({
        ...portMessage(f, 'agent', [port]),
        source: {} as MessageEventSource
      })
    ],
    [
      '표지가 다르다',
      (f: Fixture, port: unknown) => ({
        ...portMessage(f, 'agent', [port]),
        data: { type: 'other', host: 'agent' }
      })
    ],
    ['호스트가 셸이다', (f: Fixture, port: unknown) => portMessage(f, 'shell', [port])],
    ['포트가 없다', (f: Fixture) => portMessage(f, 'agent', [])],
    // 0324 EP-27′ ② — "포트 1" 의 다른 쪽. 첫 포트(검사 대상)를 붙이면 요청이 그리로 간다.
    [
      '포트가 둘이다',
      (f: Fixture, port: unknown) => portMessage(f, 'agent', [port, hostPort().page])
    ]
  ])('%s → 붙지 않는다 — 요청은 줄을 선 채다', async (_name, make) => {
    const f = fixture()
    installOo(f.win)
    const agent = hostPort()
    f.post(make(f, agent.page))
    let settled = false
    void f.win.oo!.agent.list().then(() => (settled = true))
    // 표지 — 같은 포트 끝에서 보낸 메시지는 보낸 순서로 도착한다. 요청이 이 포트로 갔다면 표지보다 먼저 온다.
    agent.page.postMessage({ kind: 'send', channel: 'probe' })
    await vi.waitFor(() => expect(agent.received.length).toBeGreaterThan(0))
    expect(agent.received.map((m) => m.channel)).toEqual(['probe'])
    expect(settled).toBe(false)
    // 그 뒤 맞는 포트가 오면 줄 선 요청이 그 포트로 간다.
    const next = hostPort('late')
    f.post(portMessage(f, 'agent', [next.page]))
    await vi.waitFor(() => expect(settled).toBe(true))
    expect(next.received.map((m) => m.channel)).toEqual([CHANNELS.agentList])
  })
})

describe('installOo — ⑥ 포트 감싸기', () => {
  // 0324 EP-27′ ⑥ · AC33′ — 송신·수신은 '이 창이 보낸 에이전트 포트 하나를 …' 이 지난다. 여기서는 닫기 —
  // 같은 호스트의 새 포트가 오면 옛 포트를 실제 `MessagePort` 에서 닫는다(흉내 `ClientPort` 가 아니라 짝 끝의
  // `close` 로 본다).
  it('같은 호스트의 새 포트가 오면 옛 포트를 실제로 닫고 이후 요청은 새 포트로 간다', async () => {
    const f = fixture()
    installOo(f.win)
    const first = hostPort('first')
    f.post(portMessage(f, 'agent', [first.page]))
    expect(await f.win.oo!.agent.list()).toBe('first')
    const second = hostPort('second')
    f.post(portMessage(f, 'agent', [second.page]))
    await vi.waitFor(() => expect(first.closed()).toBe(true))
    expect(await f.win.oo!.agent.list()).toBe('second')
    expect(second.received.map((m) => m.channel)).toEqual([CHANNELS.agentList])
    expect(second.closed()).toBe(false)
  })
})

describe('installOo — ③ 연결 순서', () => {
  it("`message` 수신 등록이 `connectHost('all')` 보다 먼저이고 연결 요청은 1회다", () => {
    const f = fixture()
    installOo(f.win)
    expect(f.calls).toEqual(['addEventListener:message', 'connectHost:all'])
  })
})

describe('installOo — ④ 수명 통지', () => {
  // 0324 AC29′·AC33′ — 호스트가 죽거나 다시 붙으면 renderer 에 알린다. 첫 포트·종료 없는 포트 교체는 알리지 않는다.
  it('호스트 수명 통지 — 종료와 그 뒤의 새 포트만 알리고, 구독 해제 뒤에는 알리지 않는다', () => {
    const f = fixture()
    installOo(f.win)
    const seen: HostLifecycleEvent[] = []
    const off = f.win.oo!.hosts.onLifecycle((event) => seen.push(event))
    // 첫 포트 · 종료 없는 교체 — 통지 없음.
    f.post(portMessage(f, 'agent', [hostPort().page]))
    f.post(portMessage(f, 'agent', [hostPort().page]))
    expect(seen).toEqual([])
    // 첫 포트 전에 종료가 와도 그 뒤의 첫 포트는 다시 붙은 것이 아니다.
    f.exit('data')
    f.post(portMessage(f, 'data', [hostPort().page]))
    expect(seen).toEqual([{ host: 'data', kind: 'exited' }])
    seen.length = 0
    f.exit('agent')
    f.post(portMessage(f, 'agent', [hostPort().page]))
    // 다시 붙은 뒤의 종료 없는 교체도 통지 없음 — 다시 붙으면 죽음 표시가 풀린다.
    f.post(portMessage(f, 'agent', [hostPort().page]))
    off()
    f.exit('agent')
    f.post(portMessage(f, 'agent', [hostPort().page]))
    expect(seen).toEqual([
      { host: 'agent', kind: 'exited' },
      { host: 'agent', kind: 'reconnected' }
    ])
  })
})

describe('installOo — ⑤ 재연결 요청', () => {
  it('종료 뒤 첫 요청이 그 호스트의 연결을 요청한다 — 에이전트 · 데이터', () => {
    const f = fixture()
    installOo(f.win)
    f.post(portMessage(f, 'agent', [hostPort().page]))
    f.post(portMessage(f, 'data', [hostPort().page]))
    f.connect.mockClear()
    f.exit('agent')
    f.exit('data')
    void f.win.oo!.agent.list().catch(() => {})
    expect(f.connect.mock.calls).toEqual([['agent']])
    void f.win.oo!.session.list().catch(() => {})
    expect(f.connect.mock.calls).toEqual([['agent'], ['data']])
  })
})
