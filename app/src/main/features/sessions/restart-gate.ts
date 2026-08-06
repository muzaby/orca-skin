// 재시작 게이트의 lease 파생(0166 A12·A13) — 컴포지션 루트가 인라인으로 계산하던 것을 떼어냈다.
// "작업 중인가" 는 **부작용이 무거운 판정**(업데이트 설치 여부를 가른다)인데, 부팅 전체를 띄우지
// 않고는 검증할 수 없는 자리에 있으면 회귀를 못 잡는다(verify 0166 F1 — 이 경로 테스트 0건).
//
// 핵심 교정: 판정 대상은 **turn 집합이 아니라 lease 집합**이다. 구 구조는 `supervisor.all()`
// (= 등록된 turn)을 셌는데, 턴이 교체되는 창(child 반납 ~ 다음 child 등록)에는 turn 이 0개라
// **작업 중인데 "유휴" 로 보였다** → 그 창에서 업데이트가 설치될 수 있었다(D4).

import type { RestartGateState } from '../../../shared/update-restart'
import type { SessionChainLease } from './session-chain-lease'

// 게이트 상태 중 **lease 에서 파생되는 부분집합** — 나머지(activeDbWriteCount·isIndexing)는
// Bootstrap 자신의 카운터다. 정본에서 Pick 해 두 곳이 손으로 어긋나지 않게 한다.
type LeaseGateState = Pick<RestartGateState, 'isGenerating' | 'activeToolCallCount'>

/** lease 가 하나라도 살아 있으면 생성 중이다 — activeChild 유무와 무관(교체 창 포함). */
export function deriveLeaseGateState<W>(leases: readonly SessionChainLease<W>[]): LeaseGateState {
  return {
    isGenerating: leases.length > 0,
    activeToolCallCount: leases.reduce(
      (sum, lease) => sum + (lease.activeChild?.openToolRuns.size ?? 0),
      0
    )
  }
}
