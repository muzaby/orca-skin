// fork/handoff 도착 물질화 (L1 domain, handoff 0062). 컨텍스트 전달은 SDK 네이티브
// forkSession 에 위임하므로 Orca 측 일은 (a) lineage 영속(공통) + (b) fork 만 display 복사
// (원문 transcript 를 도착 세션 DB 로 — handoff 는 모델 컨텍스트만 이력을 보유, 원문은
// 출발 세션에서 확인)뿐이다.
//
// 호출 시점 불변식: 도착 세션행(insertSession) 이후 · 첫 user 발화 영속 이전 — 복사된
// 이력이 원본 idx 를 보존해 새 발화가 이력 뒤 MAX(idx)+1 로 정렬된다(ipc/chat/persist.ts).

import type { DbQueries } from '../db/queries'
import type { LineageRelation } from '../db/types'

export interface ContinuityArrival {
  childSessionId: string
  parentSessionId: string
  relation: LineageRelation
  createdAt: number
}

export function materializeContinuityArrival(db: DbQueries, arrival: ContinuityArrival): void {
  if (arrival.relation === 'fork') {
    const copied = db.copyMessagesToSession(arrival.parentSessionId, arrival.childSessionId)
    // '분기된 지점' 구분선(r5 피드백 3) — 복사된 원본 이력과 이후 새 대화 사이에 마커 파트를
    // 영속한다(compact_boundary 와 동형). 복사 직후 MAX(idx)+1 이라 새 user 발화보다 앞선다.
    // 렌더러 fork draft 프리필(chatStore.startForkDraft)도 같은 위치에 합성 — 라이브/재로드 일치.
    if (copied > 0) {
      const markerId = db.appendMessage({
        sessionId: arrival.childSessionId,
        role: 'assistant',
        content: '',
        createdAt: arrival.createdAt
      })
      db.appendPart({
        messageId: markerId,
        type: 'fork_boundary',
        toolRunId: null,
        payloadJson: '{}'
      })
    }
  }
  db.insertLineage({
    childSessionId: arrival.childSessionId,
    parentSessionId: arrival.parentSessionId,
    relation: arrival.relation,
    forkPointMessageIdx: null,
    createdAt: arrival.createdAt
  })
}
