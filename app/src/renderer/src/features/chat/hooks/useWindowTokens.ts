import { useComputePaint } from '../../../shared/compute/diagnostics'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { computeClient, type ComputeHandle, type Priority } from '../../../shared/compute/client'
import { TOKENS_RANGE_MAX_LINES } from '../../../shared/compute/limits'
import {
  requestKey,
  type TokenSource,
  type ComputeResults,
  type TokenRows
} from '../../../shared/compute/protocol'
import { getThemeSnapshot, subscribeTheme } from '../../../shared/ui/markdown/themeStore'
import { isLang } from '../../../shared/ui/markdown/syntax'

export function useWindowTokens(
  source: TokenSource,
  lang: string | undefined,
  start: number,
  priority: Priority,
  enabled: boolean
): TokenRows | undefined {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    () => 'github-light' as const
  )
  const request = useMemo(
    () =>
      lang && isLang(lang) && enabled
        ? {
            kind: 'tokens' as const,
            ...source,
            lang,
            theme,
            start,
            end: start + TOKENS_RANGE_MAX_LINES
          }
        : null,
    [source, lang, theme, start, enabled]
  )
  const [result, setResult] = useState<{ key: string; rows: TokenRows } | null>(null)
  const handle = useRef<ComputeHandle<ComputeResults['tokens']> | null>(null)
  const currentPriority = useRef(priority)
  useEffect(() => {
    currentPriority.current = priority
    handle.current?.setPriority(priority)
  }, [priority])
  useEffect(() => {
    if (!request) return
    const key = requestKey(request)
    const task = computeClient().request(request, { priority: currentPriority.current })
    handle.current = task
    let current = true
    void task.promise.then(
      ({ rows }) => {
        if (current) setResult({ key, rows })
      },
      () => {}
    )
    return () => {
      current = false
      handle.current = null
      task.cancel()
    }
  }, [request])
  useComputePaint(request && result?.key === requestKey(request) ? result.key : null)
  return request && result?.key === requestKey(request) ? result.rows : undefined
}
