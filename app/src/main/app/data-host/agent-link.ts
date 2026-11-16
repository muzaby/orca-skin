// 데이터 호스트 쪽 피어 링크 (0324 AR-13 · AR-15 · EP-21 · EP-2′ · F2~F4).
//
// - 에이전트 호스트가 보낸 `data.query`·`data.write`·`settings.write` 를 표로 받는다.
// - 설정 사본을 보낸다 — 연결될 때마다 전체, 바뀔 때 패치(F3).
// - 실행 쪽에 부탁한다(`agent.call`). 요청 종류마다 에이전트 호스트를 확보할지가 다르다(EP-21):
//   `request` 는 연결이 없으면 바로 실패하고(활동 조회·런타임 폐기 — 세션을 열기만 해도 에이전트
//   호스트가 뜨면 안 된다), `requestEnsured` 는 셸에 기동을 부탁하고 줄을 선다(예약 셸 명령 ·
//   네이티브 이력 읽기 — 받는 쪽 없이 버려지면 안 된다).
// 받는 분기의 동기 구간은 피어 링크가 `perf.stall`(`source:'peer'`)로 잰다.

import type { PeerMethod } from '../../../shared/peer-protocol'
import type { Settings } from '../../../shared/protocol'
import { createPeerLink, type PeerLink, type PeerPort } from '../../infra/ipc/peer-link'
import { createOpDispatcher, type OpTable } from '../../infra/ipc/peer-ops'
import type { AgentCallOps } from '../agent-host/agent-ops'

export interface AgentLinkDeps {
  queryOps: OpTable
  writeOps: OpTable
  settings: {
    getAll(): Settings
    patch(input: unknown): Settings
    onPatch(listener: (next: Settings, changedKeys: readonly string[]) => void): void
  }
  // 셸에 에이전트 호스트 기동을 부탁한다(`peer.ensure`).
  ensureAgent(): void
  // 그 밖의 요청·통지(턴 저장 스트림 · 오류 보고) — 저장 수신기와 보고 허브가 받는다.
  onRequest?(method: PeerMethod, payload: unknown): unknown
  onNotify?(method: PeerMethod, payload: unknown): void
  onInvalid?(): void
  clock?: () => number
}

export interface AgentLink {
  readonly link: PeerLink<'data'>
  // 연결이 없으면 바로 실패한다 — 에이전트 호스트를 띄우지 않는다.
  request<K extends keyof AgentCallOps>(
    op: K,
    ...args: Parameters<AgentCallOps[K]>
  ): Promise<Awaited<ReturnType<AgentCallOps[K]>>>
  // 연결이 없으면 에이전트 호스트를 띄워 달라고 한 뒤 줄을 선다.
  requestEnsured<K extends keyof AgentCallOps>(
    op: K,
    ...args: Parameters<AgentCallOps[K]>
  ): Promise<Awaited<ReturnType<AgentCallOps[K]>>>
  attach(port: PeerPort): void
  // 셸의 `peer.unavailable` — 줄 선 요청을 모두 실패시킨다.
  unavailable(): void
}

export function createAgentLink(deps: AgentLinkDeps): AgentLink {
  const query = createOpDispatcher(deps.queryOps)
  const write = createOpDispatcher(deps.writeOps)
  const link = createPeerLink({
    side: 'data',
    onRequest: (method, payload) => {
      if (method === 'data.query') return query(payload)
      if (method === 'data.write') return write(payload)
      if (method === 'settings.write') {
        deps.settings.patch(payload)
        return undefined
      }
      if (deps.onRequest) return deps.onRequest(method, payload)
      throw new Error(`데이터 호스트가 받지 않는 요청: ${method}`)
    },
    onNotify: (method, payload) => deps.onNotify?.(method, payload),
    ensure: () => deps.ensureAgent(),
    ...(deps.onInvalid ? { onInvalid: deps.onInvalid } : {}),
    ...(deps.clock ? { clock: deps.clock } : {})
  })
  // 에이전트 호스트는 사본을 받은 뒤에야 설정을 읽을 수 있다 — 연결마다 전체를 먼저 보낸다.
  link.onConnected(() => link.notify('settings.snapshot', deps.settings.getAll()))
  deps.settings.onPatch((settings, changedKeys) => {
    link.notify('settings.patch', { settings, changedKeys: [...changedKeys] })
  })
  return {
    link,
    request: (op, ...args) => link.request('agent.call', { op, args }) as never,
    requestEnsured: (op, ...args) => link.requestEnsured('agent.call', { op, args }) as never,
    attach: (port) => link.attach(port),
    unavailable: () => link.unavailable()
  }
}
