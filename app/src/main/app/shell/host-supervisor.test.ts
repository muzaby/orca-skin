// 호스트 감독 (0324 SD-04″ · EP-12 · VP-22″ · AC18′ · AC29′ · AC32′). 두 호스트가 같은 감독자를 쓰고,
// 언제 띄우고 다시 띄울지는 `boot.ts` 가 정한다(그 순서는 `boot.test.ts`).
//
// 프로세스·포트 채널·프로세스 목록·시계를 가짜로 준다. 규칙 칸(§10 EP-12)의 분기마다 입력을 둔다:
// 에이전트 호스트 비정상 exit → 고아 종료 → 통지 → 상태 비움(순서) · 데이터 호스트 exit → 통지만 ·
// shutdown 중 exit → 통지 0 · shutdown 제한 시간 초과 → kill 1회 · 연속 기동 실패 3회 → 부팅 오류.

import { describe, expect, it } from 'vitest'
import {
  HOST_BOOT_FAILURE_LIMIT,
  HOST_SHUTDOWN_TIMEOUT_MS,
  createHostSupervisor,
  shutdownHosts,
  type HostProcess,
  type HostSupervisorDeps,
  type SupervisedClient
} from './host-supervisor'
import type { ProcessInfo } from './orphans'

type Port = { readonly name: string }

class FakeProcess implements HostProcess<Port> {
  readonly posted: Array<{ message: unknown; ports?: readonly Port[] }> = []
  kills = 0
  private messageListener: ((data: unknown) => void) | null = null
  private exitListener: ((code: number) => void) | null = null
  constructor(private readonly pidValue: number | undefined) {}
  pid(): number | undefined {
    return this.pidValue
  }
  postMessage(message: unknown, ports?: readonly Port[]): void {
    this.posted.push(ports ? { message, ports } : { message })
  }
  onMessage(listener: (data: unknown) => void): void {
    this.messageListener = listener
  }
  onExit(listener: (code: number) => void): void {
    this.exitListener = listener
  }
  kill(): void {
    this.kills += 1
  }
  emit(data: unknown): void {
    this.messageListener?.(data)
  }
  exit(code = 1): void {
    this.exitListener?.(code)
  }
}

class FakeClock {
  private next = 1
  readonly timers = new Map<number, { callback: () => void; ms: number }>()
  setTimeout(callback: () => void, ms: number): unknown {
    const id = this.next++
    this.timers.set(id, { callback, ms })
    return id
  }
  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number)
  }
  fire(): void {
    for (const [id, timer] of [...this.timers]) {
      this.timers.delete(id)
      timer.callback()
    }
  }
}

const READY = { type: 'ready', mirror: { uiLocale: 'ko' } }
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

interface Harness {
  readonly forks: FakeProcess[]
  readonly log: string[]
  readonly clock: FakeClock
  readonly hostMessages: unknown[]
  supervisor: ReturnType<typeof createHostSupervisor<Port>>
  client(id: number, trusted?: boolean): SupervisedClient<Port> & { ports: Port[] }
}

function setup(options: {
  kind: 'agent' | 'data'
  processes?: readonly ProcessInfo[]
  pids?: Array<number | undefined>
}): Harness {
  const forks: FakeProcess[] = []
  const log: string[] = []
  const clock = new FakeClock()
  const hostMessages: unknown[] = []
  let channel = 0
  const pids = options.pids ?? [4200, 4300, 4400, 4500]
  const deps: HostSupervisorDeps<Port> = {
    fork: () => {
      const child = new FakeProcess(pids[forks.length])
      forks.push(child)
      log.push('fork')
      return child
    },
    createChannel: () => {
      channel += 1
      return { port1: { name: `host-${channel}` }, port2: { name: `client-${channel}` } }
    },
    clock,
    onBootFailed: () => log.push('boot-failed')
  }
  if (options.kind === 'agent') {
    deps.isReady = (message) => (message as { type?: unknown }).type === 'ready'
    deps.onHostMessage = (message) => hostMessages.push(message)
    deps.orphans = {
      listProcesses: async () => {
        log.push('list')
        return options.processes ?? []
      },
      killTree: async (pid) => {
        log.push(`kill:${pid}`)
      },
      onError: (stage) => log.push(`orphan-error:${stage}`)
    }
    deps.onExited = () => log.push('clear')
  }
  const supervisor = createHostSupervisor(deps)
  return {
    forks,
    log,
    clock,
    hostMessages,
    supervisor,
    client: (id, trusted = true) => {
      const ports: Port[] = []
      return {
        id,
        ports,
        trusted: () => trusted,
        deliverPort: (port) => {
          ports.push(port)
          log.push(`port:${id}:${port.name}`)
        },
        notify: (event) => log.push(`${event}:${id}`)
      }
    }
  }
}

describe('createHostSupervisor — 기동과 창 연결', () => {
  it('상한은 기동 실패 3회 · 종료 대기 3초다 (§11 "재기동"·"종료" 행)', () => {
    expect(HOST_BOOT_FAILURE_LIMIT).toBe(3)
    expect(HOST_SHUTDOWN_TIMEOUT_MS).toBe(3_000)
  })

  it('감독자는 창 연결·ensureRunning 전에는 fork 하지 않는다 — 기동 시점은 boot.ts 가 정한다', () => {
    const h = setup({ kind: 'data' })
    expect(h.forks).toHaveLength(0)
    h.supervisor.attach(h.client(1))
    expect(h.forks).toHaveLength(1)
  })

  it('준비 판정이 없으면 fork 직후 준비되어 창에 포트와 준비를 보낸다', () => {
    const h = setup({ kind: 'data' })
    h.supervisor.attach(h.client(1))
    expect(h.supervisor.phase()).toBe('ready')
    expect(h.log).toEqual(['fork', 'port:1:client-1', 'ready:1'])
    expect(h.forks[0].posted).toEqual([
      {
        message: { type: 'client.connect', clientId: 1, trusted: true },
        ports: [{ name: 'host-1' }]
      }
    ])
  })

  it('에이전트 호스트는 준비 메시지 전에는 포트를 넘기지 않는다', () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    expect(h.supervisor.phase()).toBe('starting')
    expect(h.forks[0].posted).toEqual([])
    h.forks[0].emit({ type: 'lifecycle' })
    expect(h.supervisor.phase()).toBe('starting')
    h.forks[0].emit(READY)
    expect(h.supervisor.phase()).toBe('ready')
    expect(h.log).toEqual(['fork', 'port:1:client-1', 'ready:1'])
  })

  it('기동 중에 등록한 창은 준비 메시지가 온 뒤에 포트를 받는다', () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    h.supervisor.attach(h.client(1))
    expect(h.forks).toHaveLength(1)
    expect(h.forks[0].posted).toEqual([])
    h.forks[0].emit(READY)
    expect(h.log).toEqual(['fork', 'port:1:client-1', 'ready:1'])
  })

  it('준비된 뒤 다시 온 준비 메시지는 포트를 또 넘기지 않는다', () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    h.forks[0].emit(READY)
    h.forks[0].emit(READY)
    expect(h.log).toEqual(['fork', 'port:1:client-1', 'ready:1'])
    expect(h.forks[0].posted).toHaveLength(1)
  })

  it('호스트가 보낸 메시지는 준비 메시지를 포함해 모두 전달한다', () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    h.forks[0].emit({ type: 'shell.mirror' })
    h.forks[0].emit(READY)
    expect(h.hostMessages).toEqual([{ type: 'shell.mirror' }, READY])
  })

  it('준비된 뒤 등록한 창은 바로 포트를 받고, 창마다 포트가 다르다', () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    h.forks[0].emit(READY)
    h.supervisor.attach(h.client(1, true))
    h.supervisor.attach(h.client(2, false))
    expect(h.forks).toHaveLength(1)
    expect(h.forks[0].posted).toEqual([
      {
        message: { type: 'client.connect', clientId: 1, trusted: true },
        ports: [{ name: 'host-1' }]
      },
      {
        message: { type: 'client.connect', clientId: 2, trusted: false },
        ports: [{ name: 'host-2' }]
      }
    ])
    expect(h.log.slice(1)).toEqual(['port:1:client-1', 'ready:1', 'port:2:client-2', 'ready:2'])
  })

  it('신뢰 판정은 포트를 넘길 때마다 다시 읽는다', () => {
    const h = setup({ kind: 'data' })
    let trusted = true
    h.supervisor.attach({
      id: 1,
      trusted: () => trusted,
      deliverPort: () => {},
      notify: () => {}
    })
    trusted = false
    h.forks[0].exit()
    h.supervisor.ensureRunning()
    expect(h.forks[1].posted[0].message).toEqual({
      type: 'client.connect',
      clientId: 1,
      trusted: false
    })
  })

  it('떠 있는 동안 ensureRunning 은 다시 fork 하지 않는다', () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    h.supervisor.ensureRunning()
    h.forks[0].emit(READY)
    h.supervisor.ensureRunning()
    expect(h.forks).toHaveLength(1)
  })

  it('떼어 낸 창은 재기동 때 포트를 받지 않는다', () => {
    const h = setup({ kind: 'data' })
    h.supervisor.attach(h.client(1))
    h.supervisor.attach(h.client(2))
    h.supervisor.detach(1)
    h.forks[0].exit()
    h.supervisor.ensureRunning()
    expect(h.forks[1].posted.map((p) => (p.message as { clientId: number }).clientId)).toEqual([2])
  })
})

describe('createHostSupervisor — 비정상 종료와 재기동', () => {
  it('에이전트 호스트 exit → 자식만 끝내고 → 창에 알리고 → 상태를 비운다, 순서대로 (AC29)', async () => {
    const h = setup({
      kind: 'agent',
      processes: [
        { pid: 10, parentPid: 4200 },
        { pid: 11, parentPid: 4200 },
        { pid: 12, parentPid: 1 }
      ]
    })
    h.supervisor.attach(h.client(1))
    h.supervisor.attach(h.client(2))
    h.forks[0].emit(READY)
    h.log.length = 0
    h.forks[0].exit()
    await flush()
    expect(h.log).toEqual(['list', 'kill:10', 'kill:11', 'exited:1', 'exited:2', 'clear'])
    expect(h.supervisor.phase()).toBe('idle')
  })

  it('비정상 종료 뒤 스스로 띄우지 않고 다음 ensureRunning 에 띄운다 (AC29′)', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    h.forks[0].emit(READY)
    h.forks[0].exit()
    await flush()
    expect(h.forks).toHaveLength(1)
    h.supervisor.ensureRunning()
    expect(h.forks).toHaveLength(2)
  })

  it('다시 뜬 호스트가 준비되면 등록된 창마다 새 포트와 준비를 보낸다 (AC33′ 의 셸 쪽)', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    h.forks[0].emit(READY)
    h.forks[0].exit()
    await flush()
    h.log.length = 0
    h.supervisor.ensureRunning()
    h.forks[1].emit(READY)
    expect(h.log).toEqual(['fork', 'port:1:client-2', 'ready:1'])
    expect(h.forks[1].posted[0].ports).toEqual([{ name: 'host-2' }])
  })

  it('정리하는 사이에 온 기동 요청은 종료 통지가 끝난 뒤에 fork 한다', async () => {
    let releaseList: (processes: readonly ProcessInfo[]) => void = () => {}
    const h = setup({ kind: 'agent' })
    const supervisor = createHostSupervisor<Port>({
      fork: () => {
        const child = new FakeProcess(4200 + h.forks.length)
        h.forks.push(child)
        h.log.push('fork')
        return child
      },
      createChannel: () => ({ port1: { name: 'h' }, port2: { name: 'c' } }),
      clock: h.clock,
      isReady: (message) => message === 'ready',
      orphans: {
        listProcesses: () =>
          new Promise((resolve) => {
            releaseList = resolve
          }),
        killTree: async () => {},
        onError: () => {}
      },
      onExited: () => h.log.push('clear'),
      onBootFailed: () => h.log.push('boot-failed')
    })
    supervisor.attach(h.client(1))
    h.forks[0].emit('ready')
    h.forks[0].exit()
    supervisor.ensureRunning()
    expect(h.forks).toHaveLength(1)
    expect(supervisor.phase()).toBe('exiting')
    releaseList([])
    await flush()
    expect(h.log.filter((entry) => entry !== 'port:1:c' && entry !== 'ready:1')).toEqual([
      'fork',
      'exited:1',
      'clear',
      'fork'
    ])
    expect(supervisor.phase()).toBe('starting')
  })

  it('데이터 호스트 exit 는 창에 알리기만 한다 — 고아 정리·상태 비움 없음 (AC18′ · 재기동은 boot.ts)', async () => {
    const h = setup({ kind: 'data' })
    h.supervisor.attach(h.client(1))
    h.log.length = 0
    h.forks[0].exit()
    await flush()
    expect(h.log).toEqual(['exited:1'])
    h.supervisor.ensureRunning()
    expect(h.forks).toHaveLength(2)
  })

  it('pid 를 모르는 호스트의 exit 는 프로세스 목록을 읽지 않는다', async () => {
    const h = setup({ kind: 'agent', pids: [undefined] })
    h.supervisor.attach(h.client(1))
    h.forks[0].emit(READY)
    h.log.length = 0
    h.forks[0].exit()
    await flush()
    expect(h.log).toEqual(['exited:1', 'clear'])
  })

  it('옛 프로세스의 늦은 메시지·exit 는 무시한다', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    h.forks[0].emit(READY)
    h.forks[0].exit()
    await flush()
    h.supervisor.ensureRunning()
    h.log.length = 0
    h.forks[0].emit(READY)
    h.forks[0].exit()
    await flush()
    expect(h.log).toEqual([])
    expect(h.hostMessages).toEqual([READY])
    expect(h.supervisor.phase()).toBe('starting')
  })

  it(`준비 전에 ${HOST_BOOT_FAILURE_LIMIT}번 연속 죽으면 더 띄우지 않고 부팅 오류를 한 번 알린다`, async () => {
    const h = setup({ kind: 'agent' })
    for (let i = 0; i < HOST_BOOT_FAILURE_LIMIT; i++) {
      h.supervisor.ensureRunning()
      h.forks[i].exit()
      await flush()
    }
    expect(h.log.filter((entry) => entry === 'boot-failed')).toHaveLength(1)
    expect(h.supervisor.phase()).toBe('failed')
    h.supervisor.ensureRunning()
    h.supervisor.attach(h.client(1))
    expect(h.forks).toHaveLength(HOST_BOOT_FAILURE_LIMIT)
  })

  it('준비에 성공하면 연속 실패 수가 0 이 된다', async () => {
    const h = setup({ kind: 'agent' })
    for (let i = 0; i < HOST_BOOT_FAILURE_LIMIT - 1; i++) {
      h.supervisor.ensureRunning()
      h.forks[i].exit()
      await flush()
    }
    h.supervisor.ensureRunning()
    h.forks[HOST_BOOT_FAILURE_LIMIT - 1].emit(READY)
    h.forks[HOST_BOOT_FAILURE_LIMIT - 1].exit()
    await flush()
    h.supervisor.ensureRunning()
    h.forks[HOST_BOOT_FAILURE_LIMIT].exit()
    await flush()
    expect(h.log).not.toContain('boot-failed')
    expect(h.supervisor.phase()).toBe('idle')
  })

  it('준비된 뒤의 비정상 종료는 연속 실패 수를 늘리지 않는다', async () => {
    const h = setup({ kind: 'agent', pids: [1, 2, 3, 4, 5] })
    // 실패 2 → 준비 후 종료 → 실패 2: 준비가 수를 0 으로 되돌렸으니 상한(3)에 닿지 않는다.
    const bootFail = async (i: number): Promise<void> => {
      h.supervisor.ensureRunning()
      h.forks[i].exit()
      await flush()
    }
    await bootFail(0)
    h.supervisor.ensureRunning()
    h.forks[1].emit(READY)
    h.forks[1].exit()
    await flush()
    await bootFail(2)
    await bootFail(3)
    expect(h.log).not.toContain('boot-failed')
    expect(h.supervisor.phase()).toBe('idle')
  })

  it('준비된 뒤의 비정상 종료는 기동 실패로 세지 않는다', async () => {
    const h = setup({ kind: 'agent' })
    for (let i = 0; i < HOST_BOOT_FAILURE_LIMIT; i++) {
      h.supervisor.ensureRunning()
      h.forks[i].emit(READY)
      h.forks[i].exit()
      await flush()
    }
    expect(h.log).not.toContain('boot-failed')
    expect(h.supervisor.phase()).toBe('idle')
  })
})

describe('createHostSupervisor — 정상 종료', () => {
  it('종료 요청 뒤 제때 끝나면 kill 하지 않고 창에 알리지 않는다 (AC32′)', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    h.forks[0].emit(READY)
    h.log.length = 0
    let done = false
    const stopping = h.supervisor.shutdown().then(() => {
      done = true
    })
    expect(h.forks[0].posted.at(-1)).toEqual({ message: { type: 'shutdown' } })
    expect(h.supervisor.phase()).toBe('stopping')
    await flush()
    expect(done).toBe(false)
    h.forks[0].exit(0)
    await stopping
    expect(h.forks[0].kills).toBe(0)
    expect(h.clock.timers.size).toBe(0)
    expect(h.log).toEqual([])
    expect(h.supervisor.phase()).toBe('stopped')
  })

  it('제한 시간 안에 끝나지 않으면 한 번 kill 한다 (AC32′)', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    h.forks[0].emit(READY)
    const stopping = h.supervisor.shutdown()
    expect([...h.clock.timers.values()].map((timer) => timer.ms)).toEqual([
      HOST_SHUTDOWN_TIMEOUT_MS
    ])
    h.clock.fire()
    expect(h.forks[0].kills).toBe(1)
    h.forks[0].exit()
    await stopping
    expect(h.log).not.toContain('exited:1')
    expect(h.supervisor.phase()).toBe('stopped')
  })

  it('종료 뒤에는 다시 띄우지 않는다', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    const stopping = h.supervisor.shutdown()
    h.forks[0].exit()
    await stopping
    h.supervisor.ensureRunning()
    h.supervisor.attach(h.client(1))
    expect(h.forks).toHaveLength(1)
  })

  it('떠 있지 않으면 바로 끝나고 이후에도 띄우지 않는다', async () => {
    const h = setup({ kind: 'data' })
    await h.supervisor.shutdown()
    h.supervisor.attach(h.client(1))
    expect(h.forks).toHaveLength(0)
  })

  it('두 번 불러도 종료 요청은 한 번이다', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.ensureRunning()
    const first = h.supervisor.shutdown()
    const second = h.supervisor.shutdown()
    expect(second).toBe(first)
    expect(
      h.forks[0].posted.filter((p) => (p.message as { type: string }).type === 'shutdown')
    ).toHaveLength(1)
    h.forks[0].exit()
    await first
  })

  it('비정상 종료를 정리하는 중에 종료가 오면 다시 띄우지 않는다', async () => {
    const h = setup({ kind: 'agent' })
    h.supervisor.attach(h.client(1))
    h.forks[0].exit()
    h.supervisor.ensureRunning()
    await h.supervisor.shutdown()
    await flush()
    expect(h.forks).toHaveLength(1)
    expect(h.supervisor.phase()).toBe('stopped')
  })

  it('앱 종료는 에이전트 호스트를 먼저 내리고 그 뒤에 데이터 호스트를 내린다 (AC32′)', async () => {
    const order: string[] = []
    let releaseAgent: () => void = () => {}
    const agent = {
      shutdown: () => {
        order.push('agent:start')
        return new Promise<void>((resolve) => {
          releaseAgent = () => {
            order.push('agent:end')
            resolve()
          }
        })
      }
    }
    const data = {
      shutdown: async () => {
        order.push('data:start')
      }
    }
    const all = shutdownHosts({ data, agent })
    await flush()
    expect(order).toEqual(['agent:start'])
    releaseAgent()
    await all
    expect(order).toEqual(['agent:start', 'agent:end', 'data:start'])
  })

  it('준비 훅은 창에 포트를 넘긴 뒤에 불리고, 준비 전에는 셸 메시지를 보내지 않는다', () => {
    const forks: FakeProcess[] = []
    const events: string[] = []
    const supervisor = createHostSupervisor<Port>({
      fork: () => {
        const child = new FakeProcess(4200)
        forks.push(child)
        return child
      },
      createChannel: () => ({ port1: { name: 'host' }, port2: { name: 'client' } }),
      clock: new FakeClock(),
      isReady: (message) => (message as { type?: unknown }).type === 'ready',
      onBootFailed: () => events.push('boot-failed'),
      onReady: () => events.push('ready')
    })
    supervisor.attach({
      id: 1,
      trusted: () => true,
      deliverPort: () => events.push('port'),
      notify: (event) => events.push(`client:${event}`)
    })
    expect(supervisor.post({ type: 'peer.connect' })).toBe(false)
    forks[0].emit(READY)
    expect(events).toEqual(['port', 'client:ready', 'ready'])
    expect(supervisor.post({ type: 'peer.connect' }, [{ name: 'p' }])).toBe(true)
    expect(forks[0].posted.at(-1)).toEqual({
      message: { type: 'peer.connect' },
      ports: [{ name: 'p' }]
    })
  })

  it('셸 서비스 응답·깨어남은 준비 전에도 떠 있는 호스트에 간다 — 떠 있지 않거나 내려간 뒤에는 보내지 않는다', async () => {
    const forks: FakeProcess[] = []
    const supervisor = createHostSupervisor<Port>({
      fork: () => {
        const child = new FakeProcess(4300)
        forks.push(child)
        return child
      },
      createChannel: () => ({ port1: { name: 'host' }, port2: { name: 'client' } }),
      clock: new FakeClock(),
      isReady: (message) => (message as { type?: unknown }).type === 'ready',
      onBootFailed: () => {}
    })
    expect(supervisor.send({ type: 'wake', reason: 'resume' })).toBe(false)
    supervisor.ensureRunning()
    expect(supervisor.phase()).toBe('starting')
    expect(supervisor.send({ type: 'service.result', id: 0, ok: true })).toBe(true)
    expect(forks[0].posted.at(-1)?.message).toEqual({ type: 'service.result', id: 0, ok: true })
    const stopping = supervisor.shutdown()
    forks[0].exit(0)
    await stopping
    expect(supervisor.send({ type: 'wake', reason: 'resume' })).toBe(false)
  })
})
