import { useWorkerRetry } from '../../../shared/compute/useWorkerRetry'
import { createContext, useEffect, useState, useSyncExternalStore } from 'react'
import { computeClient } from '../../../shared/compute/client'
import {
  getThemeSnapshot,
  subscribeTheme,
  type ShikiThemeId
} from '../../../shared/ui/markdown/themeStore'
import type { DiffLine } from '../lib/diffLines'
import { diffTokensRequest, mapDiffTokens, type DiffSyntaxTokens } from '../lib/diffSyntax'

type HighlightedLines = DiffSyntaxTokens
const EMPTY: HighlightedLines = new Map()
export const DiffSyntaxContext = createContext<HighlightedLines>(EMPTY)

// diff 줄의 문법 토큰 — 계산 워커가 만든다(0324 AC9). 응답 전·실패·미지원 언어는 빈 맵이라
// 소비자는 원문을 그린다.
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

  const retryWorker = useWorkerRetry('compute', lines)
  useEffect(() => {
    const request = diffTokensRequest(lines, filePath, theme)
    if (!request) return
    const handle = retryWorker(() => computeClient().request(request))
    handle.promise
      .then((rows) =>
        setHighlighted({ lines, filePath, theme, tokens: mapDiffTokens(lines, rows) })
      )
      .catch(() => {
        // 취소·워커 실패 — diff 원문과 줄 동작은 그대로 사용할 수 있다.
      })
    return () => handle.cancel()
  }, [lines, filePath, theme, retryWorker])

  return highlighted?.lines === lines &&
    highlighted.filePath === filePath &&
    highlighted.theme === theme
    ? highlighted.tokens
    : EMPTY
}
