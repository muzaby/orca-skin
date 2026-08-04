// 0167 대기 라벨 파생 규칙 — AC12(사실 조합)·AC14(무활동 라벨)·AC21(foreground 미적용)·
// 길이 규칙(상위 2 + 합계). 시각이 아니라 **로직**이므로 순수 함수로 고정한다.
import { describe, expect, it } from 'vitest'
import {
  deriveActivityLabel,
  IDLE_HINT_MS,
  MAX_VISIBLE_FACTS,
  type ActivityView
} from './activityLabel'

const view = (patch: Partial<ActivityView> = {}): ActivityView => ({
  foreground: 'idle',
  queuedCount: 0,
  deliveryPendingCount: 0,
  residualCount: 0,
  backgroundTaskCount: 0,
  listening: false,
  ...patch
})

describe('deriveActivityLabel — 사실 조합 (AC12)', () => {
  it('여러 이유가 동시에 있으면 우선순위로 하나만 고르지 않고 **함께** 싣는다', () => {
    const label = deriveActivityLabel(
      view({ listening: true, backgroundTaskCount: 2, deliveryPendingCount: 1 }),
      0
    )
    expect(label.facts).toEqual([
      { key: 'deliveryPending', count: 1 },
      { key: 'background', count: 2 }
    ])
  })

  it('residual 은 deliveryPending 의 부분집합이라 일반 전달분에서 차감한다 (중복 표기 방지)', () => {
    const label = deriveActivityLabel(
      view({ listening: true, deliveryPendingCount: 3, residualCount: 3 }),
      0
    )
    // 같은 메시지를 "전달 확인 3" + "중단 후 대기 3" 으로 두 번 세지 않는다.
    expect(label.facts).toEqual([{ key: 'residual', count: 3 }])
  })

  it('일부만 잔여면 나머지가 일반 전달분으로 남는다', () => {
    const label = deriveActivityLabel(
      view({ listening: true, deliveryPendingCount: 5, residualCount: 2 }),
      0
    )
    expect(label.facts).toEqual([
      { key: 'deliveryPending', count: 3 },
      { key: 'residual', count: 2 }
    ])
  })

  it('0 인 항목은 싣지 않는다', () => {
    expect(deriveActivityLabel(view({ listening: true }), 0).facts).toEqual([])
  })
})

describe('deriveActivityLabel — 표시 순서 (앞 MAX_VISIBLE_FACTS 개가 화면 몫)', () => {
  it('사실은 고정 순서로 쌓인다 — 화면은 앞 2건, 나머지는 호출자가 합계로 접는다', () => {
    const label = deriveActivityLabel(
      view({
        listening: true,
        deliveryPendingCount: 4,
        residualCount: 1,
        queuedCount: 2,
        backgroundTaskCount: 5
      }),
      0
    )
    expect(label.facts.map((f) => f.key)).toEqual([
      'deliveryPending',
      'queued',
      'residual',
      'background'
    ])
    expect(label.facts.slice(0, MAX_VISIBLE_FACTS).map((f) => f.key)).toEqual([
      'deliveryPending',
      'queued'
    ])
  })
})

describe('deriveActivityLabel — 상태 (AC14 · AC21)', () => {
  it('preparing 은 준비 라벨', () => {
    expect(deriveActivityLabel(view({ foreground: 'preparing' }), 0).status).toBe('preparing')
  })

  it('streaming 중에는 대기 라벨을 붙이지 않는다 — 사실이 있어도 verb 를 유지한다', () => {
    const label = deriveActivityLabel(
      view({ foreground: 'streaming', queuedCount: 3, backgroundTaskCount: 1 }),
      IDLE_HINT_MS * 10
    )
    // AC21 — foreground 구간에는 무활동 라벨 미적용. 모델이 실제로 응답 중이다.
    expect(label.status).toBe('streaming')
    // 사실 자체는 그대로 보인다(무엇을 기다리는지는 알려준다).
    expect(label.facts.map((f) => f.key)).toEqual(['queued', 'background'])
  })

  it('idle + listening 이면 대기 라벨', () => {
    expect(deriveActivityLabel(view({ listening: true }), 0).status).toBe('waiting')
  })

  it('idle + 사실만 있어도(listening 아님) 대기 라벨', () => {
    expect(deriveActivityLabel(view({ backgroundTaskCount: 1 }), 0).status).toBe('waiting')
  })

  it('idle + 대기 사유 없음이면 streaming(기본 verb) — 라벨을 만들지 않는다', () => {
    expect(deriveActivityLabel(view(), 0).status).toBe('streaming')
  })

  it(`무활동 ${IDLE_HINT_MS}ms 경과 시 라벨만 finishingSlow 로 바뀐다`, () => {
    expect(deriveActivityLabel(view({ listening: true }), IDLE_HINT_MS - 1).status).toBe('waiting')
    expect(deriveActivityLabel(view({ listening: true }), IDLE_HINT_MS).status).toBe(
      'finishingSlow'
    )
  })

  it('activity 미제공(레거시 호출부)은 streaming 으로 기존 동작을 유지한다', () => {
    expect(deriveActivityLabel(undefined, IDLE_HINT_MS * 10)).toEqual({
      status: 'streaming',
      facts: []
    })
  })
})
