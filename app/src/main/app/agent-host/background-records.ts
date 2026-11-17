// 백그라운드 작업 기록의 복원 읽기 (0324 EP-16′).
//
// `BackgroundController.state` 는 정본이 메모리에 없을 때 기록을 동기로 읽어 상태를 다시 만든다.
// 기록은 데이터 호스트 DB 에 있으므로, 동기 읽기 앞의 비동기 구간(상태 요청 · 턴 시작)이 현재
// 기록을 받아 두고 동기 읽기가 그것을 한 번만 쓴다. 한 번 쓴 기록은 버린다 — 정본이 생긴 뒤의
// 기록은 정본이 더 새롭고, 정본이 사라진 뒤에는 다음 비동기 구간이 다시 받는다.

import type { BackgroundEvent } from '../../../shared/background-task'

export interface BackgroundRecords {
  // 동기 복원 읽기 — 받아 둔 기록을 꺼낸다. 없으면 빈 목록이다.
  load(sessionId: string): BackgroundEvent[]
  // 정본이 없을 때만 현재 기록을 받아 둔다.
  prefetch(sessionId: string): Promise<void>
  forget(sessionId: string): void
}

export function createBackgroundRecords(deps: {
  read(sessionId: string): Promise<BackgroundEvent[]>
  hasCanonical(sessionId: string): boolean
}): BackgroundRecords {
  const received = new Map<string, BackgroundEvent[]>()
  return {
    load(sessionId) {
      const events = received.get(sessionId) ?? []
      received.delete(sessionId)
      return events
    },
    async prefetch(sessionId) {
      if (deps.hasCanonical(sessionId)) return
      const events = await deps.read(sessionId)
      // 받는 사이 정본이 생겼다 — 받아 둔 기록이 정본보다 옛 것이다.
      if (deps.hasCanonical(sessionId)) received.delete(sessionId)
      else received.set(sessionId, events)
    },
    forget: (sessionId) => void received.delete(sessionId)
  }
}
