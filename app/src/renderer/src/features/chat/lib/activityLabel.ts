// 대기 라벨 파생(0167 D) — **순수 함수**. StatusLine 이 JSX 안에서 계산하던 것을 떼어냈다:
// 조합 규칙(사실 나열·상위 2개+합계·무활동 임계·foreground 미적용)은 시각이 아니라 로직이라
// 시각 검증 관례로 넘기면 안 된다(verify 0150 D4 / 0157 D8 의 반복 지적).
//
// i18n 은 여기서 하지 않는다 — **키 + count** 만 돌려주고 번역은 컴포넌트가 한다. 그래야
// 테스트가 문구 변경에 깨지지 않고 규칙만 고정한다.

import type { ChatActivitySnapshot, WorktreePrepareStep } from '../../../../../shared/ipc'

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
  /** 0 인 항목을 뺀 전체 사실 — 화면은 앞 `MAX_VISIBLE_FACTS` 개만 쓰고 나머지는 합계로 접는다. */
  facts: ActivityFact[]
  /**
   * 0211 — 격리 준비 단계. 있으면 화면은 **이것만** 말한다: 무작위 동사와 활동 사실은
   * 준비 중에 참이 아니고(모델은 아직 시작도 안 했다), 사용자가 기다리는 이유는 이 단계다.
   */
  prepareStep?: WorktreePrepareStep
}

export type ActivityView = Pick<
  ChatActivitySnapshot,
  'foreground' | 'queuedCount' | 'deliveryPendingCount' | 'residualCount' | 'backgroundTaskCount'
> & { listening: boolean }

export function deriveActivityLabel(
  activity: ActivityView | undefined,
  elapsedMs: number,
  prepareStep?: WorktreePrepareStep | null
): ActivityLabelModel {
  // 준비 단계가 **모든 것을 이긴다**(§10 EP-03). 이 분기가 없으면 아래 폴백이 `streaming` 을
  // 돌려주고 화면은 다시 무작위 동사를 그린다 — R-01 이 화면에 도달하지 못한다.
  if (prepareStep) return { status: 'preparing', facts: [], prepareStep }
  if (!activity) return { status: 'streaming', facts: [] }

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

  return { status: deriveStatus(activity, facts.length > 0, elapsedMs), facts }
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
