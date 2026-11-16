// 두 호스트의 수명 순서 (0324 SD-04″ · EP-19 · EP-21 · AC18′·AC31′·AC32′·AC33′·AC48).
//
// - 기동: 데이터 호스트(DB 준비) → 에이전트 호스트 → 피어 포트 → 창. 두 호스트가 처음 모두 준비되면
//   `whenReady` 가 풀린다. 어느 쪽이든 기동 실패 상한에 닿으면 거부한다(본 화면 조건 = D-046).
// - 에이전트 호스트는 데이터 호스트가 처음 준비되기 전에는 띄우지 않는다 — 창 연결도 그때까지 미룬다.
// - 피어 포트: 두 호스트가 모두 준비될 때마다(어느 쪽이 다시 떠도) 새 1쌍을 넘긴다.
// - 데이터 호스트가 비정상 종료하면 바로 다시 띄운다. 에이전트 호스트는 다음 요청(창의 연결 요청 ·
//   데이터 호스트의 `peer.ensure`)에서 다시 뜬다.
// - `peer.ensure`: 에이전트 호스트가 없으면 띄우고, 기동 실패 상한이면 데이터 호스트에 `peer.unavailable`.
// - 종료: 에이전트 → 데이터(`shutdownHosts`).
//
// 감독자 생성·포트 채널을 주입받는다 — 이 파일은 Electron 을 모른다.

import { shutdownHosts, type HostSupervisor, type SupervisedClient } from './host-supervisor'

export type HostKind = 'data' | 'agent'

// 감독자에 넘길 훅 — 생성하는 쪽이 자기 deps 에 합친다.
export interface HostBootHooks {
  onReady(): void
  onBootFailed(): void
  onExited(): void
}

export interface HostBootDeps<P> {
  createSupervisor(kind: HostKind, hooks: HostBootHooks): HostSupervisor<P>
  createChannel(): { readonly port1: P; readonly port2: P }
  // 에이전트 호스트 비정상 종료의 마지막 단계(수명 상태 비움 — 감독자의 창 통지 뒤).
  onAgentExited?(): void
}

// 창 하나 — 호스트마다 포트를 따로 받는다.
export interface BootClient<P> {
  readonly id: number
  readonly data: SupervisedClient<P>
  readonly agent: SupervisedClient<P>
}

export interface HostBoot<P> {
  start(): void
  whenReady(): Promise<void>
  attach(client: BootClient<P>): void
  detach(clientId: number): void
  // 창이 에이전트 호스트 종료 뒤 첫 요청에서 보낸 연결 요청.
  connectAgent(): void
  // 데이터 호스트가 보낸 `peer.ensure`.
  peerEnsure(): void
  shutdown(): Promise<void>
}

export const HOST_BOOT_FAILED_ERROR = '호스트를 띄우지 못했다'

export function createHostBoot<P>(deps: HostBootDeps<P>): HostBoot<P> {
  let resolveReady: () => void = () => {}
  let rejectReady: (error: Error) => void = () => {}
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  // 미처리 거부 경고를 막는다 — 소비자는 `whenReady()` 로 따로 받는다.
  ready.catch(() => {})
  let settled = false
  let dataEverReady = false
  let ensurePending = false
  const pendingAgentClients = new Map<number, SupervisedClient<P>>()

  const settle = (error?: Error): void => {
    if (settled) return
    settled = true
    if (error) rejectReady(error)
    else resolveReady()
  }

  const mediatePeer = (): void => {
    if (data.phase() !== 'ready' || agent.phase() !== 'ready') return
    const { port1, port2 } = deps.createChannel()
    data.post({ type: 'peer.connect' }, [port1])
    agent.post({ type: 'peer.connect' }, [port2])
  }

  const data: HostSupervisor<P> = deps.createSupervisor('data', {
    onReady: () => {
      if (!dataEverReady) {
        dataEverReady = true
        for (const client of pendingAgentClients.values()) agent.attach(client)
        pendingAgentClients.clear()
        agent.ensureRunning()
        return
      }
      mediatePeer()
    },
    onBootFailed: () => settle(new Error(`${HOST_BOOT_FAILED_ERROR}: data`)),
    // 데이터 호스트는 DB 소유자라 바로 다시 띄운다(AC18′).
    onExited: () => data.ensureRunning()
  })

  const agent: HostSupervisor<P> = deps.createSupervisor('agent', {
    onReady: () => {
      ensurePending = false
      mediatePeer()
      if (data.phase() === 'ready') settle()
    },
    onBootFailed: () => {
      settle(new Error(`${HOST_BOOT_FAILED_ERROR}: agent`))
      if (ensurePending) {
        ensurePending = false
        data.post({ type: 'peer.unavailable' })
      }
    },
    onExited: () => deps.onAgentExited?.()
  })

  return {
    start: () => data.ensureRunning(),
    whenReady: () => ready,
    attach(client) {
      data.attach(client.data)
      if (dataEverReady) agent.attach(client.agent)
      else pendingAgentClients.set(client.id, client.agent)
    },
    detach(clientId) {
      data.detach(clientId)
      agent.detach(clientId)
      pendingAgentClients.delete(clientId)
    },
    connectAgent() {
      if (!dataEverReady) return
      agent.ensureRunning()
    },
    peerEnsure() {
      const phase = agent.phase()
      if (phase === 'ready') return
      if (phase === 'failed') {
        data.post({ type: 'peer.unavailable' })
        return
      }
      ensurePending = true
      agent.ensureRunning()
    },
    shutdown: () => shutdownHosts({ data, agent })
  }
}
