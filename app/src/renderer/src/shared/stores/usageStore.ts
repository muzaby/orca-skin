// 사용량 mirror (0186) — Main read model 의 in-memory 사본. **캐시 프레임워크가 아니다.**
//
// 하지 않는 것: TTL · localStorage/IndexedDB 영속 · polling · 원격 fetch · 원격 freshness 판단 ·
// 주/월 계산. 그 전부는 Main 이 소유하고 여기로는 완성된 `UsageLimitsView` 만 온다.
//
// ── 왜 features/cost 가 아니라 shared/stores 인가 ────────────────────────────
// 이 상태를 읽는 곳이 `features/chat`(도넛 팝오버 경유 pages) 와 `features/settings`(사용량 탭)
// 둘이다. renderer boundaries 는 `features → 다른 features` 를 막으므로(`eslint.config.mjs`)
// 어느 feature 에 두든 나머지 하나가 못 읽는다. 같은 성격의 공유 미러인 `agentStore` 가 이미
// 여기 있다. 이 배치 덕에 구 `ProviderUsageController` 구조적 인터페이스 + app 레이어 주입
// 우회가 통째로 사라졌다.

import { create } from 'zustand'
import type { UsageDelta, UsageLimitsView } from '../../../../shared/usage/limits'
import { costApi } from '../api/ipc'

interface UsageStoreState {
  global: UsageLimitsView | null
  providers: Record<string, UsageLimitsView>
  lastUpdatedAt: number | null
}

export const useUsageStore = create<UsageStoreState>()(() => ({
  global: null,
  providers: {},
  lastUpdatedAt: null
}))

export async function initUsage(): Promise<void> {
  const global = await costApi.usage()
  useUsageStore.setState({ global, lastUpdatedAt: Date.now() })
}

// main→renderer delta 구독. 변경된 scope 만 갈아끼운다 — 전체 map 을 교체하지 않는다.
export function subscribeUsage(): () => void {
  return costApi.onUsage((delta: UsageDelta) => {
    if (delta.scope === 'global') {
      useUsageStore.setState({ global: delta.value, lastUpdatedAt: Date.now() })
      return
    }
    useUsageStore.setState((s) => ({
      providers: { ...s.providers, [delta.providerKey]: delta.value },
      lastUpdatedAt: Date.now()
    }))
  })
}

// 한 provider 를 확보한다. 이미 있으면 재조회하지 않는다 — 갱신은 delta push 가 담당하고,
// 이 함수는 "아직 본 적 없는 provider" 의 최초 1회를 위한 것이다(설정 서브탭 진입 등).
export async function ensureProviderUsage(providerKey: string): Promise<void> {
  if (useUsageStore.getState().providers[providerKey]) return
  await refreshProviderUsage(providerKey)
}

// 명시적 재조회 — 설정 사용량 탭의 동기화 버튼이 쓴다.
export async function refreshProviderUsage(providerKey: string): Promise<void> {
  const value = await costApi.usage(providerKey)
  if (!value) return
  useUsageStore.setState((s) => ({
    providers: { ...s.providers, [providerKey]: value },
    lastUpdatedAt: Date.now()
  }))
}

// 한도 쓰기 — main 이 갱신된 뷰를 되돌려주므로 재조회가 필요 없다.
export async function setProviderLimit(
  providerKey: string,
  limitUsd: number | null
): Promise<void> {
  const value = await costApi.setProviderLimit(providerKey, limitUsd)
  useUsageStore.setState((s) => ({
    providers: { ...s.providers, [providerKey]: value },
    lastUpdatedAt: Date.now()
  }))
}

export function useGlobalUsage(): UsageLimitsView | null {
  return useUsageStore((s) => s.global)
}

// provider 뷰. 아직 안 받았으면 null — 호출부가 전역으로 폴백하거나 섹션을 숨긴다.
export function useProviderUsage(providerKey: string | null | undefined): UsageLimitsView | null {
  return useUsageStore((s) => (providerKey ? (s.providers[providerKey] ?? null) : null))
}

export function useUsageUpdatedAt(): number | null {
  return useUsageStore((s) => s.lastUpdatedAt)
}
