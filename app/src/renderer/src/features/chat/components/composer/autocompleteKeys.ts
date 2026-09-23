// 열린 caret-토큰 자동완성(`/` skill · `@` mention)의 키보드 분기.
//
// 대상은 hook이 flatten한 옵션 배열뿐이다 — 그룹 header는 이 배열에 없으므로 ↑/↓ 순환과
// Enter/Tab 선택 index에 끼어들지 않는다. 처리한 키면 true를 돌려 호출부가 기본 동작
// (줄바꿈·전송·포커스 이동)을 막게 한다.
export interface KeyboardAutocomplete<T> {
  suggestions: readonly T[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  close: () => void
}

export function handleAutocompleteKey<T>(
  key: string,
  autocomplete: KeyboardAutocomplete<T>,
  pick: (suggestion: T) => void
): boolean {
  const length = autocomplete.suggestions.length
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (length > 0) {
      const offset = key === 'ArrowDown' ? 1 : -1
      autocomplete.setActiveIndex((autocomplete.activeIndex + offset + length) % length)
    }
    return true
  }
  if (key === 'Enter' || key === 'Tab') {
    const suggestion = autocomplete.suggestions[autocomplete.activeIndex]
    if (suggestion !== undefined) pick(suggestion)
    return true
  }
  if (key === 'Escape') {
    autocomplete.close()
    return true
  }
  return false
}
