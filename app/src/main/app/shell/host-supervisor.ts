// 호스트 프로세스 하나의 감독 (0324 SD-04 · EP-12 · AR-02 · §11 "에이전트 호스트의 규칙").
//
// fork · 준비 · 창 포트 중개 · 비정상 종료 처리 · 재기동 · 정상 종료를 맡는다. 에이전트 호스트와
// 데이터 호스트가 같은 감독자를 쓰고, 차이(준비 판정·고아 정리·종료 뒤 처리)는 주입으로 준다.
// 프로세스 생성·포트 채널·프로세스 목록·시계를 모두 주입받는다 — 이 파일은 Electron 을 모른다.

import { reapOrphans, type OrphanReaperDeps } from './orphans'

// 연속으로 이만큼 준비 전에 죽으면 더 띄우지 않는다.
export const HOST_BOOT_FAILURE_LIMIT = 3
// 정상 종료 요청 뒤 이 시간 안에 끝나지 않으면 강제로 끝낸다.
export const HOST_SHUTDOWN_TIMEOUT_MS = 3_000

// fork 한 호스트 하나. 실제 구현은 `utilityProcess` 를 이 모양으로 감싼다.
export interface HostProcess<P> {
  // 아직 뜨지 않았으면 undefined.
  pid(): number | undefined
  postMessage(message: unknown, ports?: readonly P[]): void
  onMessage(listener: (data: unknown) => void): void
  onExit(listener: (code: number) => void): void
  kill(): void
}

// 감독자가 포트를 넘길 창 하나.
export interface SupervisedClient<P> {
  readonly id: number
  // 포트를 넘기는 시점에 판정한다 — 현재 앱 창의 신뢰한 최상위 문서인가.
  trusted(): boolean
  // 이 창 몫의 포트 한쪽을 preload 에 넘긴다.
  deliverPort(port: P): void
  // 호스트가 준비됐다(새 포트를 받은 직후) · 호스트가 죽었다.
  notify(event: 'ready' | 'exited'): void
}

export interface Clock {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface HostSupervisorDeps<P> {
  fork(): HostProcess<P>
  createChannel(): { readonly port1: P; readonly port2: P }
  clock: Clock
  // 이 메시지가 오면 요청을 받을 수 있다. 없으면 fork 직후부터 준비된 것으로 본다.
  isReady?(message: unknown): boolean
  // 호스트가 보낸 메시지 전부(준비 메시지 포함).
  onHostMessage?(message: unknown): void
  // 있으면 비정상 종료 때 그 호스트를 부모로 둔 프로세스를 먼저 끝낸다(에이전트 호스트).
  orphans?: OrphanReaperDeps
  // 비정상 종료의 마지막 단계 — 창 통지 뒤에 부른다(에이전트 호스트: 수명 상태 비움).
  onExited?(): void
  // 연속 기동 실패가 상한에 닿았다. 한 번만 부른다.
  onBootFailed(): void
}

// `exiting` — 비정상 종료를 처리하는 중(고아 정리 → 창 통지 → 상태 비움). 그 사이의 기동 요청은
// 처리가 끝난 뒤에 띄운다 — 새 호스트의 포트가 옛 호스트의 종료 통지보다 먼저 가면 안 된다.
type Phase = 'idle' | 'starting' | 'ready' | 'exiting' | 'stopping' | 'stopped' | 'failed'

export interface HostSupervisor<P> {
  // 떠 있지 않으면 띄운다. 종료 중·종료 뒤·기동 실패 상한 뒤에는 아무것도 하지 않는다.
  ensureRunning(): void
  // 창을 등록한다. 호스트가 준비돼 있으면 바로 포트를 넘기고, 아니면 띄운 뒤 넘긴다.
  // 호스트가 다시 뜨면 등록된 창마다 새 포트를 넘긴다.
  attach(client: SupervisedClient<P>): void
  detach(clientId: number): void
  // 정상 종료를 요청하고 끝날 때까지 기다린다. 제한 시간을 넘기면 강제로 끝낸다.
  shutdown(): Promise<void>
  phase(): Phase
}

export function createHostSupervisor<P>(deps: HostSupervisorDeps<P>): HostSupervisor<P> {
  const clients = new Map<number, SupervisedClient<P>>()
  let phase: Phase = 'idle'
  let current: HostProcess<P> | null = null
  let bootFailures = 0
  let restartRequested = false
  let stopped: (() => void) | null = null
  let stopPromise: Promise<void> | null = null

  const connect = (child: HostProcess<P>, client: SupervisedClient<P>): void => {
    const { port1, port2 } = deps.createChannel()
    child.postMessage({ type: 'client.connect', clientId: client.id, trusted: client.trusted() }, [
      port1
    ])
    client.deliverPort(port2)
  }

  const becomeReady = (child: HostProcess<P>): void => {
    phase = 'ready'
    bootFailures = 0
    for (const client of clients.values()) {
      connect(child, client)
      client.notify('ready')
    }
  }

  const handleExit = async (child: HostProcess<P>, pid: number | undefined): Promise<void> => {
    if (child !== current) return
    current = null
    if (phase === 'stopping') {
      phase = 'stopped'
      stopped?.()
      return
    }
    const bootFailed = phase === 'starting'
    phase = 'exiting'
    if (deps.orphans && pid !== undefined) await reapOrphans(deps.orphans, pid)
    for (const client of clients.values()) client.notify('exited')
    deps.onExited?.()
    // 정리하는 사이에 종료가 요청됐으면 그대로 멈춘다.
    if (phase !== 'exiting') return
    phase = 'idle'
    if (bootFailed) bootFailures += 1
    if (bootFailures >= HOST_BOOT_FAILURE_LIMIT) {
      phase = 'failed'
      restartRequested = false
      deps.onBootFailed()
      return
    }
    if (restartRequested) {
      restartRequested = false
      ensureRunning()
    }
  }

  const ensureRunning = (): void => {
    if (phase === 'exiting') {
      restartRequested = true
      return
    }
    if (phase !== 'idle') return
    const child = deps.fork()
    current = child
    phase = 'starting'
    child.onMessage((message) => {
      if (child !== current) return
      deps.onHostMessage?.(message)
      if (phase === 'starting' && deps.isReady?.(message)) becomeReady(child)
    })
    child.onExit(() => {
      void handleExit(child, child.pid())
    })
    if (!deps.isReady) becomeReady(child)
  }

  return {
    ensureRunning,
    attach(client) {
      clients.set(client.id, client)
      if (phase === 'ready' && current) {
        connect(current, client)
        client.notify('ready')
        return
      }
      ensureRunning()
    },
    detach(clientId) {
      clients.delete(clientId)
    },
    shutdown() {
      if (stopPromise) return stopPromise
      const child = current
      if (!child) {
        phase = 'stopped'
        stopPromise = Promise.resolve()
        return stopPromise
      }
      phase = 'stopping'
      stopPromise = new Promise<void>((resolve) => {
        const timer = deps.clock.setTimeout(() => child.kill(), HOST_SHUTDOWN_TIMEOUT_MS)
        stopped = () => {
          deps.clock.clearTimeout(timer)
          resolve()
        }
      })
      child.postMessage({ type: 'shutdown' })
      return stopPromise
    },
    phase: () => phase
  }
}

// 앱 종료 — 데이터 호스트를 먼저 내리고 에이전트 호스트를 내린다(§11 "종료" 행).
export async function shutdownHosts(hosts: {
  data: Pick<HostSupervisor<unknown>, 'shutdown'>
  agent: Pick<HostSupervisor<unknown>, 'shutdown'>
}): Promise<void> {
  await hosts.data.shutdown()
  await hosts.agent.shutdown()
}
