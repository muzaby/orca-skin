// 에이전트 호스트 쪽 피어 링크 (0324 AR-13 · EP-16 · EP-17 · EP-2′ · F2~F4).
//
// 실행 쪽 코드가 데이터 호스트에 닿는 길은 여기 하나다:
// - `query`·`write` — DB·비밀을 읽고 쓰는 연산(`app/data-host/data-ops.ts` 의 표). 직접 호출이 아니라
//   요청이라 언제나 `await` 한다.
// - 설정 사본 — `settings.snapshot`·`settings.patch` 통지를 사본에 넣는다.
// - `agent.call` — 데이터 호스트가 실행 쪽에 부탁하는 연산(`agent-ops.ts` 의 표)을 받는다.
// 받는 분기의 동기 구간은 피어 링크가 `perf.stall`(`source:'peer'`)로 잰다.

import type { PeerMethod } from '../../../shared/peer-protocol'
import { createPeerLink, type PeerLink, type PeerPort } from '../../infra/ipc/peer-link'
import {
  createOpDispatcher,
  createRemoteOps,
  type OpTable,
  type RemoteOps
} from '../../infra/ipc/peer-ops'
import type { DataQueryOps, DataWriteOps } from '../data-host/data-ops'
import type { SettingsMirror } from './settings-mirror'

export interface DataLinkDeps {
  mirror: Pick<SettingsMirror, 'applySnapshot' | 'applyPatch'>
  // 데이터 호스트가 부를 수 있는 실행 쪽 연산.
  agentOps: OpTable
  // 데이터 호스트가 보낸 그 밖의 통지(저장 실패 등) — 저장 송신기가 받는다.
  onNotify?(method: PeerMethod, payload: unknown): void
  onInvalid?(): void
  clock?: () => number
}

export interface DataLink {
  readonly link: PeerLink<'agent'>
  readonly query: RemoteOps<DataQueryOps>
  readonly write: RemoteOps<DataWriteOps>
  // 설정 쓰기 요청 — 사본은 뒤따르는 패치 통지로 바뀐다.
  writeSettings(patch: unknown): Promise<unknown>
  attach(port: PeerPort): void
}

export function createDataLink(deps: DataLinkDeps): DataLink {
  const callAgent = createOpDispatcher(deps.agentOps)
  const link = createPeerLink({
    side: 'agent',
    onRequest: (method, payload) => {
      if (method === 'agent.call') return callAgent(payload)
      throw new Error(`에이전트 호스트가 받지 않는 요청: ${method}`)
    },
    onNotify: (method, payload) => {
      if (method === 'settings.snapshot') deps.mirror.applySnapshot(payload)
      else if (method === 'settings.patch') deps.mirror.applyPatch(payload)
      else deps.onNotify?.(method, payload)
    },
    ...(deps.onInvalid ? { onInvalid: deps.onInvalid } : {}),
    ...(deps.clock ? { clock: deps.clock } : {})
  })
  return {
    link,
    query: createRemoteOps<DataQueryOps>((payload) => link.request('data.query', payload)),
    write: createRemoteOps<DataWriteOps>((payload) => link.request('data.write', payload)),
    writeSettings: (patch) => link.request('settings.write', patch),
    attach: (port) => link.attach(port)
  }
}
