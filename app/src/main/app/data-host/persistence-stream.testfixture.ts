// 테스트용 턴 저장 스트림 (0324 EP-15 · AR-13) — 송신기 → 피어 링크 → 구조화 복제 포트 → 피어 링크 →
// 수신기를 메모리에서 잇는다. 턴 저장을 실제 경로로 거쳐야 하는 통합 테스트가 쓴다. 저장은 다음
// 마이크로태스크들에 일어나므로 DB 를 읽기 전에 `settle()` 을 기다린다.

import type { NormalizedEvent } from '../../../shared/ipc'
import type { ClientRef } from '../../contracts/client'
import type { TurnContext } from '../../contracts/turn'
import type { HistoryWriter } from '../../features/history/writer'
import type { UsageTracker } from '../../features/usage/tracker'
import type { DbQueries } from '../../infra/db/queries'
import { createPeerLink } from '../../infra/ipc/peer-link'
import { createPeerLoopback } from '../../infra/ipc/peer-loopback.testfixture'
import { createPersistenceSender, type PersistenceSender } from '../agent-host/persistence-sender'
import { createPersistenceReceiver, type PersistenceReceiver } from './persistence-receiver'

export interface PersistenceStreamOptions {
  db: DbQueries
  writer?: HistoryWriter
  usage?: Pick<UsageTracker, 'recordTurnUsage'>
  // 화면 중계 — 송신기가 그 턴의 순서대로 부른다.
  send?(owner: ClientRef, ev: NormalizedEvent): void
  failTurn?(turn: TurnContext<ClientRef>, message: string): void
}

export interface PersistenceStream {
  readonly sender: PersistenceSender
  readonly receiver: PersistenceReceiver
  // 보낸 저장 입력이 수신기에서 모두 처리될 때까지 기다린다.
  settle(): Promise<void>
  close(): void
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

export function createPersistenceStream(options: PersistenceStreamOptions): PersistenceStream {
  const loop = createPeerLoopback()
  const receiver = createPersistenceReceiver({
    db: options.db,
    usage: () => options.usage,
    notifyAgent: (method, payload) => {
      data.notify(method, payload)
    },
    ...(options.writer ? { writer: options.writer } : {})
  })
  const data = createPeerLink({
    side: 'data',
    onRequest: (method, payload) => receiver.request(method, payload),
    onNotify: (method, payload) => receiver.notify(method, payload)
  })
  const agent = createPeerLink({
    side: 'agent',
    onRequest: () => undefined,
    onNotify: (method, payload) => sender.onNotify(method, payload)
  })
  data.onClosed(() => receiver.peerClosed())
  data.attach(loop.data)
  agent.attach(loop.agent)
  let nextId = 0
  const sender = createPersistenceSender({
    newId: () => String(++nextId),
    link: agent,
    send: (owner, ev) => options.send?.(owner, ev),
    failTurn: (turn, message) => options.failTurn?.(turn, message)
  })
  return {
    sender,
    receiver,
    settle: async () => {
      await tick()
      await tick()
    },
    close: () => loop.agent.close()
  }
}
