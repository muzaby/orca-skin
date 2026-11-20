import { createContext, useContext, useEffect, useState } from 'react'
import { computeClient } from './client'
import type { ComputeTheme } from './protocol'

// The copy portal is mounted and serialized within one task. It can use a cached
// highlight, but cannot display a new worker result before it unmounts.
export const CachedHighlightOnly = createContext(false)

// 구문 강조 HTML (0324 AC8) — 계산 워커가 만든다. 응답 전·취소·워커 실패는 `null` 이라 소비자는
// 원문을 그린다. 같은 내용이 캐시에 있으면 첫 렌더에서 바로 준다(가상 스크롤 재마운트).
export function useHighlightedHtml(
  code: string,
  lang: string,
  theme: ComputeTheme,
  enabled: boolean
): string | null {
  const [hl, setHl] = useState<{ code: string; lang: string; theme: string; html: string } | null>(
    null
  )

  const cachedOnly = useContext(CachedHighlightOnly)
  useEffect(() => {
    if (cachedOnly || !enabled) return
    const handle = computeClient().request({ kind: 'highlight', code, lang, theme })
    handle.promise
      .then(({ html }) => setHl({ code, lang, theme, html }))
      .catch(() => {
        // 취소·워커 실패에도 원문은 읽을 수 있다.
      })
    return () => handle.cancel()
  }, [code, lang, theme, enabled, cachedOnly])

  if (!enabled) return null
  if (hl && hl.code === code && hl.lang === lang && hl.theme === theme) return hl.html
  return computeClient().peek({ kind: 'highlight', code, lang, theme })?.html ?? null
}
