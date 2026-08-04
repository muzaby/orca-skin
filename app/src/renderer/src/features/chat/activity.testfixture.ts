// `chat.activity` 스냅샷 테스트 픽스처 — 리듀서 스위트와 store 스위트가 같은 17줄을 복제하고
// 있었다. 스냅샷에 필드가 하나 늘 때 한쪽만 갱신되면 그 스위트는 조용히 실제 이벤트 형상을
// 검사하지 않게 되는데, 그게 바로 0167 verify D5 가 잡은 결함이다(헬퍼가 `busy` 를 transport 에
// 묶어 고정해 "잔여만 남은 idle" 분기가 한 번도 실행되지 않았다).
//
// `chatStore.testHarness` 가 아니라 별도 모듈인 이유: harness 는 모듈 스코프에서
// `requestAnimationFrame` 을 stub 하므로 순수 리듀서 스위트가 그 부작용을 물려받는다.

import type { NormalizedEvent } from '../../../../shared/ipc'

type ActivityEvent = Extract<NormalizedEvent, { type: 'chat.activity' }>

/** transport 외의 모든 축(foreground·counts)은 **독립 인자**다 — 묶어 두면 분기가 가려진다. */
export function activitySnapshot(
  revision: number,
  transport: ActivityEvent['transport'],
  patch: Partial<ActivityEvent> = {}
): ActivityEvent {
  return {
    type: 'chat.activity',
    sessionId: 's',
    revision,
    foreground: 'idle',
    transport,
    queuedCount: 0,
    deliveryPendingCount: 0,
    residualCount: 0,
    backgroundTaskCount: transport === 'listening' ? 1 : 0,
    ...patch
  }
}
