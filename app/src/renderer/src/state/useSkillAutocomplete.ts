import { useMemo, useState } from 'react'
import type { SkillInfo } from '../../../shared/ipc'

// caret 직전 부분 토큰: 줄 시작/공백 다음의 `/` 와 그 뒤 (소문자/숫자/하이픈/콜론) 0+.
// 캡처 그룹 1 = `/` 다음의 partial (빈 문자열 허용 — `/` 만 입력한 직후 picker open).
const PARTIAL_RE = /(?:^|\s)\/([a-z0-9:-]*)$/

export interface UseSkillAutocomplete {
  open: boolean
  query: string
  suggestions: SkillInfo[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  // caret 좌측 `/partial` 의 시작 인덱스 (`/` 포함). 선택 적용 시 이 위치부터
  // caret 까지 잘라내고 `/<name> ` 를 삽입한다.
  tokenStart: number
  close: () => void
}

export function useSkillAutocomplete(
  text: string,
  caret: number,
  skills: SkillInfo[]
): UseSkillAutocomplete {
  const [rawActiveIndex, setRawActiveIndex] = useState(0)
  // Escape 로 닫은 시점의 partial. partial 이 다시 바뀌면 자동 재오픈 (render 중 비교).
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)

  const match = useMemo(() => {
    const before = text.slice(0, caret)
    const m = before.match(PARTIAL_RE)
    if (!m) return null
    const partial = m[1]
    const tokenStart = caret - partial.length - 1
    return { partial, tokenStart }
  }, [text, caret])

  const suggestions = useMemo(() => {
    if (!match) return []
    const q = match.partial.toLowerCase()
    return skills.filter((s) => s.name.toLowerCase().startsWith(q)).slice(0, 8)
  }, [skills, match])

  const partial = match?.partial ?? null
  const dismissed = dismissedAt !== null && dismissedAt === partial
  // 후보 길이를 벗어난 activeIndex 는 render 중 0 으로 보정.
  const activeIndex = rawActiveIndex >= suggestions.length ? 0 : rawActiveIndex
  const open = match !== null && suggestions.length > 0 && !dismissed

  return {
    open,
    query: match?.partial ?? '',
    suggestions,
    activeIndex,
    setActiveIndex: setRawActiveIndex,
    tokenStart: match?.tokenStart ?? -1,
    close: (): void => setDismissedAt(partial)
  }
}
