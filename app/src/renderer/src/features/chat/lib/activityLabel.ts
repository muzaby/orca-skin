// 대기 라벨 파생(0167 D) — **순수 함수**. StatusLine 이 JSX 안에서 계산하던 것을 떼어냈다:
// 조합 규칙(사실 나열·상위 2개+합계·무활동 임계·foreground 미적용)은 시각이 아니라 로직이라
// 시각 검증 관례로 넘기면 안 된다(verify 0150 D4 / 0157 D8 의 반복 지적).
//
// i18n 은 여기서 하지 않는다 — **키 + count** 만 돌려주고 번역은 컴포넌트가 한다. 그래야
// 테스트가 문구 변경에 깨지지 않고 규칙만 고정한다.

import type { ChatActivitySnapshot } from '../../../../../shared/ipc'

/** 무활동 라벨 전환 임계(0167 §D 확정값). foreground 구간에는 적용하지 않는다. */
export const IDLE_HINT_MS = 30_000

/** StatusLine 에 한 줄로 보이는 최대 사실 수 — 나머지는 합계(`more`)로 접는다. */
export const MAX_VISIBLE_FACTS = 2

export type ActivityFactKey = 'deliveryPending' | 'queued' | 'residual' | 'background'

export interface ActivityFact {
  key: ActivityFactKey
  count: number
}

export type ActivityStatus = 'preparing' | 'streaming' | 'waiting' | 'finishingSlow'

export interface ActivityLabelModel {
  status: ActivityStatus
  /** 0 인 항목을 뺀 전체 사실 — tooltip/a11y 용. */
  facts: ActivityFact[]
  /** 화면에 직접 노출할 상위 N개. */
  visible: ActivityFact[]
  /** `visible` 에 담기지 못한 나머지 수(0 이면 합계 표시 없음). */
  overflow: number
}

export type ActivityView = Pick<
  ChatActivitySnapshot,
  'foreground' | 'queuedCount' | 'deliveryPendingCount' | 'residualCount' | 'backgroundTaskCount'
> & { listening: boolean }

export function deriveActivityLabel(
  activity: ActivityView | undefined,
  elapsedMs: number
): ActivityLabelModel {
  if (!activity) return { status: 'streaming', facts: [], visible: [], overflow: 0 }

  // residual 은 deliveryPending 의 **부분집합**이다. 그대로 나열하면 같은 메시지를 "전달 확인"과
  // "중단 후 전달 대기" 로 두 번 세므로 일반 전달분에서 차감한다.
  const ordinaryDeliveryPending = Math.max(
    0,
    activity.deliveryPendingCount - activity.residualCount
  )
  const facts: ActivityFact[] = [
    { key: 'deliveryPending' as const, count: ordinaryDeliveryPending },
    { key: 'queued' as const, count: activity.queuedCount },
    { key: 'residual' as const, count: activity.residualCount },
    { key: 'background' as const, count: activity.backgroundTaskCount }
  ].filter((fact) => fact.count > 0)

  const visible = facts.slice(0, MAX_VISIBLE_FACTS)
  const status = deriveStatus(activity, facts.length > 0, elapsedMs)
  return { status, facts, visible, overflow: facts.length - visible.length }
}

function deriveStatus(
  activity: ActivityView,
  hasFacts: boolean,
  elapsedMs: number
): ActivityStatus {
  if (activity.foreground === 'preparing') return 'preparing'
  // **foreground 구간에는 무활동 라벨을 붙이지 않는다**(0167 AC21) — 모델이 실제로 응답 중인데
  // "종료 확인 대기" 로 바꾸면 거짓 정보다.
  if (activity.foreground !== 'idle') return 'streaming'
  if (!activity.listening && !hasFacts) return 'streaming'
  return elapsedMs >= IDLE_HINT_MS ? 'finishingSlow' : 'waiting'
}
