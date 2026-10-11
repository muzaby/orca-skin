import { create } from 'zustand'

// 사용자 버블 펼침 상태(0257 D-011) — 키별로 앱 메모리에 둔다(디스크 저장 없음). 가상화가 화면 밖
// 항목을 언마운트했다가 다시 그려도 펼친 상태가 유지된다. 펼친 키만 담는다.
interface BubbleExpansionState {
  expanded: ReadonlySet<string>
}

export const useBubbleExpansionStore = create<BubbleExpansionState>(() => ({
  expanded: new Set<string>()
}))

export function toggleBubbleExpanded(key: string): void {
  useBubbleExpansionStore.setState(({ expanded }) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return { expanded: next }
  })
}

export function isBubbleExpanded(key: string): boolean {
  return useBubbleExpansionStore.getState().expanded.has(key)
}

export function useBubbleExpanded(key: string | undefined): boolean {
  return useBubbleExpansionStore((state) => (key ? state.expanded.has(key) : false))
}
