// 두 호스트의 수명 순서 (0324 EP-19 규칙 칸 7분기 · AC18′·AC31′·AC32′·AC33′·AC48).
// 실제 감독자에 가짜 프로세스·포트를 주입한다 — 셸 메시지와 fork 순서를 그대로 관측한다.

import { describe, expect, it } from 'vitest'
import {
  createHostBoot,
  HOST_BOOT_FAILED_ERROR,
  type BootClient,
  type HostBoot,
  type HostKind
} from './boot'
import { createHostSupervisor, HOST_BOOT_FAILURE_LIMIT, type HostProcess } from './host-supervisor'

type Port = { readonly name: string }

class FakeProcess implements HostProcess<Port> {
  readonly posted: Array<{ message: unknown; ports?: readonly Port[] }> = []
  private messageListener: ((data: unknown) => void) | null = null
  private exitListener: ((code: number) => void) | null = null
  constructor(readonly kind: HostKind) {}
  pid(): number | undefined {
    return undefined
  }
  postMessage(message: unknown, ports?: readonly Port[]): void {
    this.posted.push(ports ? { message, ports } : { message })
    if ((message as { type?: unknown }).type === 'shutdown') this.exit(0)
  }
  onMessage(listener: (data: unknown) => void): void {
    this.messageListener = listener
  }
  onExit(listener: (code: number) => void): void {
    this.exitListener = listener
  }
  kills = 0
  kill(): void {
    this.kills += 1
  }
  ready(): void {
    this.messageListener?.({ type: 'ready' })
  }
  exit(code = 1): void {
    this.exitListener?.(code)
  }
  types(): unknown[] {
    return this.posted.map((entry) => (entry.message as { type?: unknown }).type)
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

interface Harness {
  boot: HostBoot<Port>
  forks: FakeProcess[]
  log: string[]
  client(id: number): BootClient<Port>
  of(kind: HostKind): FakeProcess[]
  last(kind: HostKind): FakeProcess
  peerPorts(kind: HostKind): string[]
}

function setup(): Harness {
  const forks: FakeProcess[] = []
  const log: string[] = []
  let channel = 0
  const boot = createHostBoot<Port>({
    createSupervisor: (kind, hooks) =>
      createHostSupervisor<Port>({
        fork: () => {
          const child = new FakeProcess(kind)
          forks.push(child)
          log.push(`fork:${kind}`)
          return child
        },
        createChannel: () => {
          channel += 1
          return { port1: { name: `h${channel}` }, port2: { name: `c${channel}` } }
        },
        clock: { setTimeout: () => 0, clearTimeout: () => {} },
        isReady: (message) => (message as { type?: unknown }).type === 'ready',
        onReady: hooks.onReady,
        onBootFailed: hooks.onBootFailed,
        onExited: hooks.onExited
      }),
    createChannel: () => {
      channel += 1
      return { port1: { name: `peer-data-${channel}` }, port2: { name: `peer-agent-${channel}` } }
    },
    onAgentExited: () => log.push('agent-exited')
  })
  const client = (id: number): BootClient<Port> => ({
    id,
    data: {
      id,
      trusted: () => true,
      deliverPort: (port: Port) => log.push(`port:data:${port.name}`),
      notify: (event: 'ready' | 'exited') => log.push(`${event}:data`)
    },
    agent: {
      id,
      trusted: () => true,
      deliverPort: (port: Port) => log.push(`port:agent:${port.name}`),
      notify: (event: 'ready' | 'exited') => log.push(`${event}:agent`)
    }
  })
  const of = (kind: HostKind): FakeProcess[] => forks.filter((child) => child.kind === kind)
  const last = (kind: HostKind): FakeProcess => of(kind).at(-1) as FakeProcess
  const peerPorts = (kind: HostKind): string[] =>
    of(kind).flatMap((child) =>
      child.posted
        .filter((entry) => (entry.message as { type?: unknown }).type === 'peer.connect')
        .map((entry) => entry.ports?.[0]?.name ?? '?')
    )
  return { boot, forks, log, client, of, last, peerPorts }
}

async function bootBoth(h: Harness): Promise<void> {
  h.boot.start()
  h.last('data').ready()
  h.last('agent').ready()
  await h.boot.whenReady()
}

describe('createHostBoot', () => {
  it('기동: 데이터 fork → 준비 → 에이전트 fork → 준비 → 피어 1쌍 → 창 포트, 그 뒤에 whenReady 가 풀린다', async () => {
    const h = setup()
    let resolved = false
    void h.boot.whenReady().then(() => {
      resolved = true
    })
    h.boot.start()
    h.boot.attach(h.client(1))
    expect(h.log).toEqual(['fork:data'])
    h.last('data').ready()
    expect(h.log).toEqual(['fork:data', 'port:data:c1', 'ready:data', 'fork:agent'])
    await flush()
    expect(resolved).toBe(false)
    h.last('agent').ready()
    await flush()
    expect(resolved).toBe(true)
    expect(h.peerPorts('data')).toEqual(['peer-data-3'])
    expect(h.peerPorts('agent')).toEqual(['peer-agent-3'])
    expect(h.log.slice(4)).toEqual(['port:agent:c2', 'ready:agent'])
  })

  // 창의 에이전트 연결 요청이 데이터 호스트 준비보다 먼저 와도 에이전트 호스트는 그 뒤에 뜬다(EP-19 기동 순서).
  it('데이터 호스트 준비 전의 에이전트 연결 요청은 에이전트를 띄우지 않는다', () => {
    const h = setup()
    h.boot.start()
    h.boot.connectAgent()
    expect(h.of('agent')).toHaveLength(0)
    h.last('data').ready()
    expect(h.of('agent')).toHaveLength(1)
  })

  it('데이터 호스트 기동 실패 상한: 에이전트 fork 0 · whenReady 거부', async () => {
    const h = setup()
    h.boot.start()
    for (let i = 0; i < HOST_BOOT_FAILURE_LIMIT; i++) {
      h.last('data').exit()
      await flush()
    }
    await expect(h.boot.whenReady()).rejects.toThrow(`${HOST_BOOT_FAILED_ERROR}: data`)
    expect(h.of('data')).toHaveLength(HOST_BOOT_FAILURE_LIMIT)
    expect(h.of('agent')).toHaveLength(0)
  })

  it('에이전트 호스트 기동 실패 상한: whenReady 거부 · 데이터 호스트는 그대로', async () => {
    const h = setup()
    h.boot.start()
    h.last('data').ready()
    for (let i = 0; i < HOST_BOOT_FAILURE_LIMIT; i++) {
      h.last('agent').exit()
      await flush()
      h.boot.connectAgent()
    }
    await expect(h.boot.whenReady()).rejects.toThrow(`${HOST_BOOT_FAILED_ERROR}: agent`)
    expect(h.of('agent')).toHaveLength(HOST_BOOT_FAILURE_LIMIT)
    expect(h.of('data')).toHaveLength(1)
    expect(h.last('data').types()).not.toContain('shutdown')
  })

  it('에이전트 비정상 종료: 창 통지 → 상태 비움 · 바로 띄우지 않고 연결 요청에서 다시 뜬 뒤 피어 재연결', async () => {
    const h = setup()
    h.boot.attach(h.client(1))
    await bootBoth(h)
    h.log.length = 0
    h.last('agent').exit()
    await flush()
    expect(h.log).toEqual(['exited:agent', 'agent-exited'])
    expect(h.of('agent')).toHaveLength(1)
    h.boot.connectAgent()
    expect(h.of('agent')).toHaveLength(2)
    h.last('agent').ready()
    expect(h.peerPorts('agent')).toHaveLength(2)
    expect(h.peerPorts('data')).toHaveLength(2)
  })

  it('데이터 비정상 종료: 창 통지 → 즉시 재기동 → 창 포트·피어 재연결', async () => {
    const h = setup()
    h.boot.attach(h.client(1))
    await bootBoth(h)
    h.log.length = 0
    h.last('data').exit()
    await flush()
    expect(h.log).toEqual(['exited:data', 'fork:data'])
    h.last('data').ready()
    expect(h.log.slice(2)).toEqual([expect.stringMatching(/^port:data:/), 'ready:data'])
    expect(h.peerPorts('data')).toHaveLength(2)
    expect(h.peerPorts('agent')).toHaveLength(2)
    expect(h.of('agent')).toHaveLength(1)
  })

  it('종료: 에이전트 호스트가 끝난 뒤에 데이터 호스트에 종료를 요청한다', async () => {
    const h = setup()
    await bootBoth(h)
    const order: string[] = []
    const agent = h.last('agent')
    const data = h.last('data')
    const agentPost = agent.postMessage.bind(agent)
    agent.postMessage = (message, ports) => {
      order.push(`agent:${(message as { type: string }).type}`)
      agentPost(message, ports)
    }
    const dataPost = data.postMessage.bind(data)
    data.postMessage = (message, ports) => {
      order.push(`data:${(message as { type: string }).type}`)
      dataPost(message, ports)
    }
    await h.boot.shutdown()
    expect(order).toEqual(['agent:shutdown', 'data:shutdown'])
  })

  it('peer.ensure: 떠 있으면 아무 일 없음 · 없으면 띄워 피어를 잇고 · 기동 실패 상한이면 peer.unavailable', async () => {
    const h = setup()
    await bootBoth(h)
    h.boot.peerEnsure()
    expect(h.of('agent')).toHaveLength(1)

    h.last('agent').exit()
    await flush()
    h.boot.peerEnsure()
    expect(h.of('agent')).toHaveLength(2)
    h.last('agent').ready()
    expect(h.peerPorts('data')).toHaveLength(2)

    // 준비된 호스트의 종료는 기동 실패로 세지 않는다.
    h.last('agent').exit()
    await flush()
    for (let i = 0; i < HOST_BOOT_FAILURE_LIMIT; i++) {
      h.boot.peerEnsure()
      h.last('agent').exit()
      await flush()
    }
    // 마지막 기동 실패가 기다리던 확보 요청에 답한다.
    expect(
      h
        .last('data')
        .types()
        .filter((type) => type === 'peer.unavailable')
    ).toHaveLength(1)
    h.boot.peerEnsure()
    expect(
      h
        .last('data')
        .types()
        .filter((type) => type === 'peer.unavailable')
    ).toHaveLength(2)
  })
})
