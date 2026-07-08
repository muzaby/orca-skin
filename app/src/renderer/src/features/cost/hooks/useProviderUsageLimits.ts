// 도넛 팝오버용 provider별 사용량 한도 뷰(0082) — 현재 세션이 선택한 provider(providerKey)의
// 실사용 summary + 월 한도를 조회해 computeUsageLimits 로 파생한다. 설정 provider 서브탭(0080)과
// 동일한 데이터원(costApi.providerSummaries). providerKey 가 없으면(새 채팅·미선택) 전역 한도
// (useUsageLimits)로 폴백해 기존 동작을 보존한다. costStore 갱신(턴 종료) 시 재조회해 최신 반영.

import { useEffect, useMemo, useState } from 'react'
import type { ProviderUsageEntry } from '../../../../../shared/ipc'
import { computeUsageLimits, type UsageLimitsView } from '../../../../../shared/usage/limits'
import { costApi } from '../../../shared/api/ipc'
import { useUsageLimits } from './useUsageLimits'
import { useCostStore } from '../store/costStore'

export function useProviderUsageLimits(
  providerKey: string | null | undefined
): UsageLimitsView | null {
  const global = useUsageLimits()
  // 턴 종료 등으로 전역 summary 가 갱신된 시각 — provider 엔트리 재조회 트리거.
  const lastUpdatedAt = useCostStore((s) => s.lastUpdatedAt)
  const [entry, setEntry] = useState<ProviderUsageEntry | null>(null)

  useEffect(() => {
    // providerKey 없으면 조회하지 않는다. 남은 stale 엔트리는 아래 memo 가드가 무시(전역 폴백).
    if (!providerKey) return
    let cancelled = false
    void costApi.providerSummaries([providerKey]).then((list) => {
      if (!cancelled) setEntry(list.find((e) => e.providerKey === providerKey) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [providerKey, lastUpdatedAt])

  return useMemo(() => {
    // providerKey 전환 직후 조회 대기 중엔 이전 provider 엔트리를 쓰지 않고 전역으로 폴백.
    if (providerKey && entry && entry.providerKey === providerKey) {
      return computeUsageLimits(entry.summary, entry.limitUsd)
    }
    return global
  }, [providerKey, entry, global])
}
