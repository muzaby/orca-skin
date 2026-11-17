// 호스트 프로세스 하나의 감독 (0324 SD-04 · EP-12 · AR-02 · §11 "에이전트 호스트의 규칙").
//
// fork · 준비 · 준비 마감(EP-24 · D-055) · 창 포트 중개 · 비정상 종료 처리 · 재기동 · 정상 종료를 맡는다. 에이전트 호스트와
// 데이터 호스트가 같은 감독자를 쓰고, 차이(준비 판정·고아 정리·종료 뒤 처리)는 주입으로 준다.
// 프로세스 생성·포트 채널·프로세스 목록·시계를 모두 주입받는다 — 이 파일은 Electron 을 모른다.

import { reapOrphans, type OrphanReaperDeps } from './orphans'

// 연속으로 이만큼 준비 전에 죽으면 더 띄우지 않는다.
export const HOST_BOOT_FAILURE_LIMIT = 3
// 정상 종료 요청 뒤 이 시간 안에 끝나지 않으면 강제로 끝낸다.
export const HOST_SHUTDOWN_TIMEOUT_MS = 3_000
// 기동 중 셸과 이만큼 메시지가 오가지 않으면 그 호스트를 끝내고 기동 실패로 센다(D-055 — 범용 기본값,
// systemd `DefaultTimeoutStartSec`). 호스트가 알린 긴 단계(DB 백업·마이그레이션) 동안은 세지 않는다.
export const HOST_READY_TIMEOUT_MS = 90_000

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
  // 준비 마감(D-055) — 준비 판정이 있을 때만 쓴다. 기동 중 셸과 메시지가 오갈 때마다 다시 잡고,
  // 지나면 `onReadyTimeout` 뒤에 그 호스트를 끝낸다(그 exit 는 준비 전 종료 = 기동 실패 1회).
  readyTimeoutMs?: number
  // 호스트가 알린 긴 단계의 시작·끝. 시작부터 끝까지는 마감을 세지 않는다.
  startStep?(message: unknown): 'begin' | 'end' | undefined
  onReadyTimeout?(): void
  // 호스트가 보낸 메시지 전부(준비 메시지 포함).
  onHostMessage?(message: unknown): void
  // 있으면 비정상 종료 때 그 호스트를 부모로 둔 프로세스를 먼저 끝낸다(에이전트 호스트).
  orphans?: OrphanReaperDeps
  // 비정상 종료의 마지막 단계 — 창 통지 뒤에 부른다(에이전트 호스트: 수명 상태 비움).
  onExited?(): void
  // 연속 기동 실패가 상한에 닿았다. 한 번만 부른다.
  onBootFailed(): void
  // 준비됐다 — 창마다 새 포트를 넘긴 뒤에 부른다(재기동 포함).
  onReady?(): void
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
  // 준비된 호스트에 셸 메시지를 보낸다(피어 포트·확보 실패). 준비 전이면 보내지 않고 false.
  post(message: unknown, ports?: readonly P[]): boolean
  // 떠 있는 호스트에 준비와 무관하게 보낸다 — 기동 중에도 오가는 셸 서비스 응답·깨어남 통지.
  // 떠 있지 않으면 false.
  send(message: unknown): boolean
}

export function createHostSupervisor<P>(deps: HostSupervisorDeps<P>): HostSupervisor<P> {
  const clients = new Map<number, SupervisedClient<P>>()
  let phase: Phase = 'idle'
  let current: HostProcess<P> | null = null
  let bootFailures = 0
  let restartRequested = false
  let stopped: (() => void) | null = null
  let stopPromise: Promise<void> | null = null
  let readyTimer: unknown = null
  let readyPaused = false

  const clearReady = (): void => {
    if (readyTimer !== null) deps.clock.clearTimeout(readyTimer)
    readyTimer = null
  }
  // 기동 중인 그 child 의 마감을 지금부터 다시 잡는다. 멈춤 중이면 잡지 않는다.
  const armReady = (child: HostProcess<P>): void => {
    clearReady()
    if (!deps.isReady || !deps.readyTimeoutMs || readyPaused) return
    // 이 child 가 바뀌거나(exit) 준비·멈춤이 오면 타이머를 지운다 — 남는 경우는 기동 중 종료 요청뿐이다.
    readyTimer = deps.clock.setTimeout(() => {
      readyTimer = null
      if (phase !== 'starting') return
      deps.onReadyTimeout?.()
      child.kill()
    }, deps.readyTimeoutMs)
  }
  const pauseReady = (): void => {
    readyPaused = true
    clearReady()
  }

  const connect = (child: HostProcess<P>, client: SupervisedClient<P>): void => {
    const { port1, port2 } = deps.createChannel()
    child.postMessage({ type: 'client.connect', clientId: client.id, trusted: client.trusted() }, [
      port1
    ])
    client.deliverPort(port2)
  }

  const becomeReady = (child: HostProcess<P>): void => {
    clearReady()
    phase = 'ready'
    bootFailures = 0
    for (const client of clients.values()) {
      connect(child, client)
      client.notify('ready')
    }
    deps.onReady?.()
  }

  const handleExit = async (child: HostProcess<P>, pid: number | undefined): Promise<void> => {
    if (child !== current) return
    current = null
    clearReady()
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
    readyPaused = false
    armReady(child)
    child.onMessage((message) => {
      if (child !== current) return
      deps.onHostMessage?.(message)
      if (phase !== 'starting') return
      if (deps.isReady?.(message)) {
        becomeReady(child)
        return
      }
      const step = deps.startStep?.(message)
      if (step === 'begin') pauseReady()
      else {
        if (step === 'end') readyPaused = false
        armReady(child)
      }
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
    phase: () => phase,
    post(message, ports) {
      if (phase !== 'ready' || !current) return false
      current.postMessage(message, ports)
      return true
    },
    send(message) {
      if (!current || phase === 'stopped') return false
      current.postMessage(message)
      // 기동 중인 호스트에 답했다 — 셸 서비스 응답을 기다리던 시간은 호스트의 멈춤이 아니다.
      if (phase === 'starting') armReady(current)
      return true
    }
  }
}

// 앱 종료 — 에이전트 호스트를 먼저 내린다(런타임 정지 → 저장 스트림 비움). 그 뒤 데이터 호스트가
// 예약 작업 → 스케줄러 → DB 닫기로 정리한다(AC32′). 거꾸로 하면 DB 를 닫은 뒤 저장이 온다.
export async function shutdownHosts(hosts: {
  data: Pick<HostSupervisor<unknown>, 'shutdown'>
  agent: Pick<HostSupervisor<unknown>, 'shutdown'>
}): Promise<void> {
  await hosts.agent.shutdown()
  await hosts.data.shutdown()
}
