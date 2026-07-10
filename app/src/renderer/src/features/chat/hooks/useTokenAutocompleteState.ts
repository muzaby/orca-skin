import { useState } from 'react'

// caret-토큰 자동완성(useSkillAutocomplete · useFileAutocomplete)이 공유하는
// 활성 인덱스 + Escape 해제 상태 머신. partial 이 바뀌면(dismissedAt !== partial)
// 자동 재오픈되고, 후보 길이를 벗어난 activeIndex 는 render 중 0 으로 보정한다.
export interface TokenAutocompleteState {
  activeIndex: number
  setActiveIndex: (i: number) => void
  // Escape 로 닫힌 상태 — 호출부의 open 계산에 `!dismissed` 로 합류한다.
  dismissed: boolean
  close: () => void
}

export function useTokenAutocompleteState(
  partial: string | null,
  suggestionCount: number
): TokenAutocompleteState {
  const [rawActiveIndex, setRawActiveIndex] = useState(0)
  // Escape 로 닫은 시점의 partial. partial 이 다시 바뀌면 자동 재오픈 (render 중 비교).
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)

  return {
    activeIndex: rawActiveIndex >= suggestionCount ? 0 : rawActiveIndex,
    setActiveIndex: setRawActiveIndex,
    dismissed: dismissedAt !== null && dismissedAt === partial,
    close: (): void => setDismissedAt(partial)
  }
}
