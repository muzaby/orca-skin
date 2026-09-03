import { createContext, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getThemeSnapshot,
  subscribeTheme,
  type ShikiThemeId
} from '../../../shared/ui/markdown/themeStore'
import type { DiffLine } from '../lib/diffLines'
import { highlightDiffLines, type DiffSyntaxTokens } from '../lib/diffSyntax'

type HighlightedLines = DiffSyntaxTokens
const EMPTY: HighlightedLines = new Map()
export const DiffSyntaxContext = createContext<HighlightedLines>(EMPTY)

export function useDiffSyntax(lines: readonly DiffLine[], filePath: string): HighlightedLines {
  const theme = useSyncExternalStore<ShikiThemeId>(
    subscribeTheme,
    getThemeSnapshot,
    () => 'github-light'
  )
  const [highlighted, setHighlighted] = useState<{
    lines: readonly DiffLine[]
    filePath: string
    theme: string
    tokens: HighlightedLines
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    highlightDiffLines(lines, filePath, theme)
      .then((tokens) => {
        if (!cancelled) setHighlighted({ lines, filePath, theme, tokens })
      })
      .catch(() => {
        // 문법을 로드하지 못해도 diff 원문과 줄 동작은 그대로 사용할 수 있다.
      })
    return () => {
      cancelled = true
    }
  }, [lines, filePath, theme])

  return highlighted?.lines === lines &&
    highlighted.filePath === filePath &&
    highlighted.theme === theme
    ? highlighted.tokens
    : EMPTY
}
