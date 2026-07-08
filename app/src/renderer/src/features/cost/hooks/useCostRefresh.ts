// 사용량 동기화 훅(설정 사용량, 0080) — 마지막 업데이트 시각·inflight 플래그·수동 새로고침을
// 노출한다. "N분 전" 라벨이 시간이 지나도 갱신되도록 30초 간격으로 재렌더를 유발한다.

import { useEffect, useState } from 'react'
import { useCostStore, refreshCost } from '../store/costStore'
import { relativeTimeLabel } from '../../../../../shared/time/relative'

export function useCostRefresh(): {
  label: string | null
  refreshing: boolean
  refresh: () => void
} {
  const lastUpdatedAt = useCostStore((s) => s.lastUpdatedAt)
  const refreshing = useCostStore((s) => s.refreshing)
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return {
    label: lastUpdatedAt == null ? null : relativeTimeLabel(lastUpdatedAt),
    refreshing,
    refresh: () => void refreshCost()
  }
}
