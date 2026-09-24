import { useEffect, useMemo, useState } from 'react'
import type { FileEntry, ProviderInfo } from '../../../../../shared/ipc'
import { fileApi, providerApi } from '../../../shared/api/ipc'
import { useTokenAutocompleteState } from './useTokenAutocompleteState'
import {
  flattenMentionGroups,
  groupMentionSuggestions,
  parseMentionToken,
  type MentionGroup,
  type MentionSuggestion
} from '../lib/mentionAutocomplete'
import { pluginMentionCandidates } from '../lib/pluginMention'

export interface UseMentionAutocomplete {
  open: boolean
  loading: boolean
  dirPath: string
  groups: MentionGroup[]
  suggestions: MentionSuggestion[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  tokenStart: number
  quoted: boolean
  hasClosingQuote: boolean
  validFilePaths: ReadonlySet<string>
  validPluginIds: ReadonlySet<string>
  close: () => void
}

export function useMentionAutocomplete(
  text: string,
  caret: number,
  cwd: string | null,
  active: boolean
): UseMentionAutocomplete {
  const token = useMemo(() => parseMentionToken(text, caret), [text, caret])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [entriesByDir, setEntriesByDir] = useState<Map<string, FileEntry[]>>(new Map())
  const [cachedCwd, setCachedCwd] = useState(cwd)

  if (cwd !== cachedCwd) {
    setCachedCwd(cwd)
    setEntriesByDir(new Map())
  }

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const absorb = (state: { providers: ProviderInfo[] }): void => {
      if (!cancelled) setProviders(state.providers)
    }
    void providerApi
      .state()
      .then(absorb)
      .catch(() => {
        if (!cancelled) setProviders([])
      })
    const off = providerApi.onState(absorb)
    return () => {
      cancelled = true
      off()
    }
  }, [active])

  // 탐색한 디렉토리 항목의 합집합 — 입력 하이라이트가 실재 파일 토큰만 인정하는 근거다.
  const validFilePaths = useMemo<ReadonlySet<string>>(() => {
    const paths = new Set<string>()
    for (const [dir, entries] of entriesByDir)
      for (const entry of entries) {
        const full = dir === '' ? entry.name : `${dir}/${entry.name}`
        paths.add(entry.isDirectory ? `${full}/` : full)
      }
    return paths
  }, [entriesByDir])

  const queryDir = token?.dirPath ?? null
  useEffect(() => {
    if (!active || !cwd || queryDir === null || entriesByDir.has(queryDir)) return
    const dir = queryDir
    let cancelled = false
    void fileApi
      .list(cwd, dir)
      .then((entries) => {
        if (cancelled) return
        setEntriesByDir((previous) => {
          const next = new Map(previous)
          next.set(dir, entries)
          return next
        })
      })
      .catch(() => {
        if (cancelled) return
        setEntriesByDir((previous) => {
          const next = new Map(previous)
          next.set(dir, [])
          return next
        })
      })
    return (): void => {
      cancelled = true
    }
  }, [active, cwd, entriesByDir, queryDir])

  const visibleProviders = useMemo(() => (active ? providers : []), [active, providers])
  const plugins = useMemo(
    () => pluginMentionCandidates(visibleProviders, token?.dirPath === '' ? token.prefix : ''),
    [token, visibleProviders]
  )
  const groups = useMemo(
    () => (token ? groupMentionSuggestions(token, plugins, entriesByDir.get(token.dirPath)) : []),
    [entriesByDir, plugins, token]
  )
  const suggestions = useMemo(() => flattenMentionGroups(groups), [groups])
  const partial = token?.partial ?? null
  const { activeIndex, setActiveIndex, dismissed, close } = useTokenAutocompleteState(
    partial,
    suggestions.length
  )
  const pluginOpen = token !== null && !token.quoted && token.dirPath === '' && plugins.length > 0
  const pathOpen = token !== null && cwd !== null
  const open = active && token !== null && !dismissed && (pluginOpen || pathOpen)
  const loading = active && cwd !== null && token !== null && !entriesByDir.has(token.dirPath)
  const validPluginIds = useMemo(
    () => new Set(pluginMentionCandidates(visibleProviders).map((plugin) => plugin.id)),
    [visibleProviders]
  )

  return {
    open,
    loading,
    dirPath: token?.dirPath ?? '',
    groups,
    suggestions,
    activeIndex,
    setActiveIndex,
    tokenStart: token?.tokenStart ?? -1,
    quoted: token?.quoted ?? false,
    hasClosingQuote: token?.quoted === true && text[caret] === '"',
    validFilePaths,
    validPluginIds,
    close
  }
}
