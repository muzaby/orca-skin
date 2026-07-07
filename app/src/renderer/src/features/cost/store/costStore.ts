// Zustand cost store — 구 CostProvider(Context)의 전환(handoff 0013).
// main CostTracker 의 일/주/월 summary 읽기전용 미러. 부팅 1회 조회 + summaryEvent 구독.

import { create } from 'zustand'
import type { CostSummary } from '../../../../../shared/ipc'
import { costApi } from '../../../shared/api/ipc'

interface CostStoreState {
  summary: CostSummary | null
}

export const useCostStore = create<CostStoreState>()(() => ({ summary: null }))

export async function initCost(): Promise<void> {
  const next = await costApi.summary()
  useCostStore.setState({ summary: next })
}

export function subscribeCost(): () => void {
  return costApi.onSummary((next) => useCostStore.setState({ summary: next }))
}

export function useCostSummary(): CostSummary | null {
  return useCostStore((s) => s.summary)
}
