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
  // **provider 별로 나눈다.** 하나뿐이면 provider B 를 갱신한 시각이 provider A 화면의
  // "마지막 업데이트" 로 표시된다 — mirror scope 와 timestamp scope 가 어긋난다.
  // 전역 쪽 타임스탬프는 두지 않는다 — 전역 화면에 "마지막 업데이트" 표시가 없다.
  providerUpdatedAt: Record<string, number>
}

export const useUsageStore = create<UsageStoreState>()(() => ({
  global: null,
  providers: {},
  providerUpdatedAt: {}
}))

export async function initUsage(): Promise<void> {
  const global = await costApi.usage()
  useUsageStore.setState({ global })
}

// main→renderer delta 구독. 변경된 scope 만 갈아끼운다 — 전체 map 을 교체하지 않는다.
export function subscribeUsage(): () => void {
  return costApi.onUsage((delta: UsageDelta) => {
    const now = Date.now()
    if (delta.scope === 'global') {
      useUsageStore.setState({ global: delta.value })
      return
    }
    if (delta.scope === 'boundary') {
      // 기간이 넘어갔다 — 캐시된 provider 뷰는 전부 어제 기준이므로 **버린다**. 다시 채우는
      // 것은 화면이 실제로 필요로 할 때(`ensureProviderUsage`)뿐이라 자정에 전 provider 를
      // 재집계하지 않는다.
      useUsageStore.setState({
        global: delta.value,
        providers: {},
        providerUpdatedAt: {}
      })
      return
    }
    useUsageStore.setState((s) => ({
      providers: { ...s.providers, [delta.providerKey]: delta.value },
      providerUpdatedAt: { ...s.providerUpdatedAt, [delta.providerKey]: now }
    }))
  })
}

// 한 provider 를 확보한다. 이미 있으면 재조회하지 않는다 — 갱신은 delta push 가 담당하고,
// 이 함수는 "아직 값이 없는 provider" 의 최초 1회를 위한 것이다(서브탭 진입 · 경계 무효화 직후).
export async function ensureProviderUsage(providerKey: string): Promise<void> {
  if (useUsageStore.getState().providers[providerKey]) return
  await reloadProviderUsage(providerKey)
}

// Main 정본을 다시 읽어 온다(원격 fetch 아님). 경계 무효화 후 재적재 경로.
export async function reloadProviderUsage(providerKey: string): Promise<void> {
  applyProviderUsage(providerKey, await costApi.usage(providerKey))
}

// 설정 사용량 탭의 동기화 버튼 — **원격을 즉시 부른다.** 1분 cron 을 기다리지 않는다.
// fetcher 가 없는 배포에서는 main 이 no-op 이므로 자연히 로컬 재조회로 떨어진다.
export async function syncProviderUsage(providerKey: string): Promise<void> {
  applyProviderUsage(providerKey, await costApi.refreshUsage(providerKey))
}

// 한도 쓰기 — main 이 갱신된 뷰를 되돌려주므로 재조회가 필요 없다.
export async function setProviderLimit(
  providerKey: string,
  limitUsd: number | null
): Promise<void> {
  applyProviderUsage(providerKey, await costApi.setProviderLimit(providerKey, limitUsd))
}

function applyProviderUsage(providerKey: string, value: UsageLimitsView | null): void {
  if (!value) return
  const now = Date.now()
  useUsageStore.setState((s) => ({
    providers: { ...s.providers, [providerKey]: value },
    providerUpdatedAt: { ...s.providerUpdatedAt, [providerKey]: now }
  }))
}

export function useGlobalUsage(): UsageLimitsView | null {
  return useUsageStore((s) => s.global)
}

// provider 뷰. 아직 안 받았으면 null — 호출부가 전역으로 폴백하거나 섹션을 숨긴다.
export function useProviderUsage(providerKey: string | null | undefined): UsageLimitsView | null {
  return useUsageStore((s) => (providerKey ? (s.providers[providerKey] ?? null) : null))
}

// 그 provider 값을 마지막으로 받은 시각. 전역 타임스탬프를 대신 쓰면 다른 provider 를 갱신한
// 시각이 표시된다.
export function useProviderUsageUpdatedAt(providerKey: string): number | null {
  return useUsageStore((s) => s.providerUpdatedAt[providerKey] ?? null)
}
