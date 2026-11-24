import { reportError } from '../../../shared/errors'
import { useEffect, useMemo, useState } from 'react'
import type { FileEntry, ProviderInfo } from '../../../../../shared/ipc'
import { fileApi, hostApi, providerApi } from '../../../shared/api/ipc'
import { useTokenAutocompleteState } from './useTokenAutocompleteState'
import {
  flattenMentionGroups,
  groupMentionSuggestions,
  parseMentionToken,
  type MentionGroup,
  type MentionSuggestion
} from '../lib/mentionAutocomplete'
import {
  mergePluginMentions,
  pluginMentionCandidates,
  type PluginMention
} from '../lib/pluginMention'

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
  // 필터 없는 전체 플러그인 후보 — 컴포저 '+' 메뉴가 같은 집합을 쓴다(0259 D-006).
  plugins: readonly PluginMention[]
  close: () => void
}

export function useMentionAutocomplete(
  text: string,
  caret: number,
  cwd: string | null,
  active: boolean,
  includePlugins = true,
  observedPlugins: readonly PluginMention[] = [],
  sessionId?: string | null
): UseMentionAutocomplete {
  const token = useMemo(() => parseMentionToken(text, caret), [text, caret])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [entriesByDir, setEntriesByDir] = useState<Map<string, FileEntry[]>>(new Map())
  const [owner] = useState(() => crypto.randomUUID())
  const scope = JSON.stringify([cwd, sessionId])
  const [cachedScope, setCachedScope] = useState(scope)

  if (scope !== cachedScope) {
    setCachedScope(scope)
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
      .catch((error) => {
        if (!cancelled) {
          setProviders([])
          reportError({
            event: 'chat.mention.providers-failed',
            scope: 'chat',
            title: 'loadFailed',
            error: error
          })
        }
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
  const visibleProviders = useMemo(
    () =>
      active && includePlugins ? providers.filter((provider) => provider.status === 'valid') : [],
    [active, includePlugins, providers]
  )
  const plugins = useMemo(
    () =>
      mergePluginMentions(pluginMentionCandidates(visibleProviders), observedPlugins).filter(
        (plugin) =>
          plugin.id
            .toLowerCase()
            .startsWith((token?.dirPath === '' ? token.prefix : '').toLowerCase()) ||
          plugin.label
            .toLowerCase()
            .startsWith((token?.dirPath === '' ? token.prefix : '').toLowerCase())
      ),
    [token, visibleProviders, observedPlugins]
  )
  const groups = useMemo(
    () => (token ? groupMentionSuggestions(token, plugins, entriesByDir.get(token.dirPath)) : []),
    [entriesByDir, plugins, token]
  )
  const suggestions = useMemo(() => flattenMentionGroups(groups), [groups])
  const partial = token?.partial ?? null
  const {
    activeIndex: fallbackIndex,
    setActiveIndex: setFallbackIndex,
    dismissed,
    close
  } = useTokenAutocompleteState(partial, suggestions.length)
  const pluginOpen = token !== null && !token.quoted && token.dirPath === '' && plugins.length > 0
  const pathOpen = token !== null && cwd !== null
  const open = active && token !== null && !dismissed && (pluginOpen || pathOpen)
  const loading = active && cwd !== null && token !== null && !entriesByDir.has(token.dirPath)
  const [selected, setSelected] = useState<{ scope: string; partial: string; id: string } | null>(
    null
  )
  if (selected && (selected.scope !== scope || selected.partial !== partial || !open)) {
    setSelected(null)
  }
  const suggestionId = (item: MentionSuggestion): string =>
    item.kind === 'file' ? JSON.stringify([item.entry.name, item.entry.isDirectory]) : item.id
  const selectedIndex =
    selected && selected.scope === scope && selected.partial === partial
      ? suggestions.findIndex((item) => suggestionId(item) === selected.id)
      : -1

  useEffect(() => {
    if (!open || cwd === null || queryDir === null) return
    const dir = queryDir
    let cancelled = false
    let reading = false
    let pending = false
    let failed = false
    const store = (entries: FileEntry[]): void => {
      if (cancelled) return
      setEntriesByDir((previous) => {
        const old = previous.get(dir)
        if (
          old?.length === entries.length &&
          old.every(
            (entry, index) =>
              entry.name === entries[index].name && entry.isDirectory === entries[index].isDirectory
          )
        )
          return previous
        return new Map(previous).set(dir, entries)
      })
    }
    const refresh = async (): Promise<void> => {
      if (cancelled) return
      if (reading) {
        pending = true
        return
      }
      reading = true
      try {
        store(await fileApi.list(cwd, dir, { owner, active: true }))
        failed = false
      } catch (error) {
        if (!cancelled && !failed) {
          reportError({
            event: 'chat.mention.entries-failed',
            scope: 'chat',
            title: 'loadFailed',
            error
          })
        }
        failed = true
        store([])
      } finally {
        reading = false
        if (pending) {
          pending = false
          void refresh()
        }
      }
    }
    const offFolder = fileApi.onFolderChanged((change) => {
      if (change.cwd === cwd && change.relDir === dir) void refresh()
    })
    const offHost = hostApi.onLifecycle(({ host }) => {
      if (host === 'data') void refresh()
    })
    const onFocus = (): void => {
      void refresh()
    }
    globalThis.addEventListener?.('focus', onFocus)
    void refresh()
    return (): void => {
      cancelled = true
      offFolder()
      offHost()
      globalThis.removeEventListener?.('focus', onFocus)
      void fileApi.list(cwd, dir, { owner, active: false }).catch(() => {})
    }
  }, [open, cwd, queryDir, owner, sessionId])

  const allPlugins = useMemo(
    () => mergePluginMentions(pluginMentionCandidates(visibleProviders), observedPlugins),
    [visibleProviders, observedPlugins]
  )
  const menuPlugins = useMemo(() => pluginMentionCandidates(visibleProviders), [visibleProviders])
  const validPluginIds = useMemo(() => new Set(allPlugins.map((plugin) => plugin.id)), [allPlugins])

  return {
    open,
    loading,
    dirPath: token?.dirPath ?? '',
    groups,
    suggestions,
    activeIndex: selectedIndex >= 0 ? selectedIndex : fallbackIndex,
    setActiveIndex: (index) => {
      const item = suggestions[index]
      setFallbackIndex(index)
      setSelected(item && partial !== null ? { scope, partial, id: suggestionId(item) } : null)
    },
    tokenStart: token?.tokenStart ?? -1,
    quoted: token?.quoted ?? false,
    hasClosingQuote: token?.quoted === true && text[caret] === '"',
    validFilePaths,
    validPluginIds,
    plugins: menuPlugins,
    close
  }
}
