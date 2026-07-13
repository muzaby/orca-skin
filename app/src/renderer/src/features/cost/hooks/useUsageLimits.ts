// 사용량 한도 뷰모델 훅 — 실사용 SSOT(costStore) + 월 한도(Tweak)를 공용 순수
// computeUsageLimits 로 파생한다. 도넛 팝오버·설정 사용량이 이 단일 파생을 참조(각자 계산 금지).

import { useMemo } from 'react'
import { useCostSummary } from '../store/costStore'
import { useTweakContext } from '../../../shared/theme'
import { computeUsageLimits, type UsageLimitsView } from '../../../../../shared/usage/limits'

export function useUsageLimits(): UsageLimitsView | null {
  const summary = useCostSummary()
  const { t } = useTweakContext()
  // now 는 명시하지 않는다(렌더 순수성) — computeUsageLimits 내부 기본값이 현재 시각을 취한다.
  return useMemo(
    () => (summary ? computeUsageLimits(summary, t.spendingLimitUsd) : null),
    [summary, t.spendingLimitUsd]
  )
}
