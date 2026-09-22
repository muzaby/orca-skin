import { useState } from 'react'

// caret-토큰 자동완성(useSkillAutocomplete · useMentionAutocomplete)이 공유하는
// 활성 인덱스 + Escape 해제 상태 머신. partial 이 바뀌면(dismissedAt !== partial)
// 자동 재오픈되고, 후보 길이를 벗어난 activeIndex 는 render 중 0 으로 보정한다.
//
// partial 문자열만 dismissal identity로 쓰면 `@ → (전체 삭제) → @`가 같은 빈 문자열을
// 재사용해 새 occurrence까지 닫힌 상태로 남는다. token이 null이 되는 경계를 occurrence로
// 올려, 새 토큰은 이전 Escape·active index를 상속하지 않게 한다.
//
// **dismissal을 쓰는 것은 `close` 하나뿐이다.** 인덱스 이동(↑/↓·hover)이 dismissal 기준을
// 현재 partial로 옮기면, Escape 뒤 입력으로 재개된 popup이 다음 이동에서 다시 닫힌다.
export interface TokenAutocompleteState {
  activeIndex: number
  setActiveIndex: (i: number) => void
  // Escape 로 닫힌 상태 — 호출부의 open 계산에 `!dismissed` 로 합류한다.
  dismissed: boolean
  close: () => void
}

interface OccurrenceState {
  active: boolean
  // Escape 로 닫은 시점의 partial. 같은 occurrence 안에서 partial 이 이 값과 같을 때만 닫혀 있다.
  dismissedAt: string | null
  activeIndex: number
}

export function useTokenAutocompleteState(
  partial: string | null,
  suggestionCount: number
): TokenAutocompleteState {
  const [state, setState] = useState<OccurrenceState>(() => ({
    active: partial !== null,
    dismissedAt: null,
    activeIndex: 0
  }))

  // token 부재는 occurrence 종료, token 재등장은 새 occurrence 시작이다. 기존 hook들도 cwd
  // 변경을 같은 render-phase state 전환으로 정리하므로, 경계 직후의 첫 렌더에서 stale
  // dismissal/index가 외부로 노출되지 않게 한다.
  if ((partial === null) === state.active) {
    setState({ active: partial !== null, dismissedAt: null, activeIndex: 0 })
  }

  const sameOccurrence = partial !== null && state.active
  const activeIndex =
    !sameOccurrence || state.activeIndex >= suggestionCount ? 0 : state.activeIndex

  return {
    activeIndex,
    setActiveIndex: (index: number): void =>
      setState((previous) => (previous.active ? { ...previous, activeIndex: index } : previous)),
    dismissed: sameOccurrence && state.dismissedAt === partial,
    close: (): void => {
      if (partial === null) return
      setState((previous) => (previous.active ? { ...previous, dismissedAt: partial } : previous))
    }
  }
}
