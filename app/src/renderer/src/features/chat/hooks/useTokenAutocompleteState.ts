import { useState } from 'react'

// caret-토큰 자동완성(useSkillAutocomplete · useFileAutocomplete)이 공유하는
// 활성 인덱스 + Escape 해제 상태 머신. partial 이 바뀌면(dismissedAt !== partial)
// 자동 재오픈되고, 후보 길이를 벗어난 activeIndex 는 render 중 0 으로 보정한다.
//
// partial 문자열만 dismissal identity로 쓰면 `@ → (전체 삭제) → @`가 같은 빈 문자열을
// 재사용해 새 occurrence까지 닫힌 상태로 남는다. token이 null이 되는 경계를 occurrence로
// 올려, 새 토큰은 이전 Escape·active index를 상속하지 않게 한다.
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
  const [state, setState] = useState(() => ({
    occurrenceId: 0,
    active: partial !== null,
    partial,
    dismissed: false,
    activeIndex: 0
  }))

  // token 부재는 occurrence 종료다. 기존 hook들도 cwd 변경을 같은 render-phase state 전환으로
  // 정리하므로, clear 직후의 첫 렌더에서 stale dismissal/index가 외부로 노출되지 않게 한다.
  if (partial === null && state.active) {
    setState((previous) => ({
      ...previous,
      active: false,
      partial: null,
      dismissed: false,
      activeIndex: 0
    }))
  } else if (partial !== null && !state.active) {
    setState((previous) => ({
      occurrenceId: previous.occurrenceId + 1,
      active: true,
      partial,
      dismissed: false,
      activeIndex: 0
    }))
  }

  const sameOccurrence = partial !== null && state.active
  const activeIndex =
    !sameOccurrence || state.activeIndex >= suggestionCount ? 0 : state.activeIndex

  return {
    activeIndex,
    setActiveIndex: (index: number): void =>
      setState((previous) =>
        previous.active ? { ...previous, activeIndex: index, partial } : previous
      ),
    dismissed: sameOccurrence && state.partial === partial && state.dismissed,
    close: (): void => {
      if (partial === null) return
      setState((previous) =>
        previous.active ? { ...previous, partial, dismissed: true } : previous
      )
    }
  }
}
