// 사용량 요약(0112) 조회 훅 — 기간 탭이 바뀔 때마다 main 집계를 조회한다. 이미 본 기간은
// 캐시 값을 즉시 보여주며 뒤에서 최신값으로 교체한다(탭 전환 깜빡임 방지). 모달 닫힘 =
// 언마운트로 상태가 리셋되므로 재열림 시 항상 fresh 조회다(SettingsModal 컨벤션).

import { useEffect, useState } from 'react'
import type { UsageStats, UsageStatsRange } from '../../../../../shared/ipc'
import { costApi } from '../../../shared/api/ipc'

export function useUsageStats(range: UsageStatsRange): {
  stats: UsageStats | null
  loading: boolean
} {
  const [cache, setCache] = useState<Partial<Record<UsageStatsRange, UsageStats>>>({})

  useEffect(() => {
    let cancelled = false
    void costApi.usageStats(range).then((s) => {
      if (!cancelled) setCache((prev) => ({ ...prev, [range]: s }))
    })
    return () => {
      cancelled = true
    }
  }, [range])

  const stats = cache[range] ?? null
  return { stats, loading: stats == null }
}
