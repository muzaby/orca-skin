// 설정 모달 열림 상태의 전역 스토어 — 사이드바 사용자 버튼뿐 아니라 도넛 팝오버의
// `사용량 한도 >` 등 다른 곳에서도 특정 탭으로 열 수 있게 로컬 state 를 스토어로 승격.

import { create } from 'zustand'

// 'usage' = 전역(전체) 사용량 탭. `provider:<key>` = provider별 사용량 서브탭(0080 항목 4).
export type SettingsTabId = 'general' | 'usage' | `provider:${string}`

// provider 서브탭 id ↔ providerKey 변환 헬퍼.
export function providerTabId(key: string): SettingsTabId {
  return `provider:${key}`
}

export function providerKeyFromTab(tab: SettingsTabId): string | null {
  return tab.startsWith('provider:') ? tab.slice('provider:'.length) : null
}

interface SettingsModalState {
  open: boolean
  tab: SettingsTabId
  show: (tab?: SettingsTabId) => void
  setTab: (tab: SettingsTabId) => void
  hide: () => void
}

export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  open: false,
  tab: 'general',
  show: (tab = 'general') => set({ open: true, tab }),
  setTab: (tab) => set({ tab }),
  hide: () => set({ open: false })
}))

// opener 편의 훅 — 컴포지션 루트(app)/페이지가 도넛 `>` 등에 배선한다.
export function useOpenSettings(): (tab?: SettingsTabId) => void {
  return useSettingsModalStore((s) => s.show)
}
