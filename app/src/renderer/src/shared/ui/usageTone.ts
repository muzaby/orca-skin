// 사용량 비율(0..1) → 심각도 밴드. 여유(info=파랑)·주의(warn=노랑)·임박(bad=빨강).
// 임계 0.6/0.85 는 Meter(선형 바)·UsageCircle(도넛)·Composer conversationStatus 가 공유(0080).
// 색 매핑은 각 소비자가 자기 표현(Tailwind 클래스 / CSS 변수)으로 한다.

export type UsageTone = 'info' | 'warn' | 'bad'

export function usageToneForRatio(ratio: number): UsageTone {
  if (ratio >= 0.85) return 'bad'
  if (ratio >= 0.6) return 'warn'
  return 'info'
}
