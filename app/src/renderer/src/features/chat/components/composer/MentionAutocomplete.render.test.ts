import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '../../../../../../shared/ipc'

// 포지셔닝/portal 셸은 측정 전 null을 렌더하므로 children만 통과시킨다 — popup 본문이 대상이다.
vi.mock('./AnchoredDropdown', () => ({
  AnchoredDropdown: ({ children }: { children: unknown }) => children
}))
vi.mock('../../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' })
}))

import { MentionAutocomplete } from './MentionAutocomplete'
import {
  flattenMentionGroups,
  groupMentionSuggestions,
  parseMentionToken
} from '../../lib/mentionAutocomplete'

const JIRA = { kind: 'plugin' as const, id: 'jira-dc', label: 'Jira' }

function markup(
  text: string,
  plugins: (typeof JIRA)[],
  entries: FileEntry[] | undefined,
  activeIndex = 0,
  loading = false
): string {
  const token = parseMentionToken(text, text.length)
  if (!token) throw new Error(`expected mention token for ${text}`)
  const groups = groupMentionSuggestions(token, plugins, entries)
  return renderToStaticMarkup(
    createElement(MentionAutocomplete, {
      open: true,
      loading,
      anchorRef: { current: null },
      dirPath: token.dirPath,
      groups,
      suggestions: flattenMentionGroups(groups),
      activeIndex,
      onHover: vi.fn(),
      onPick: vi.fn()
    })
  )
}

const options = (html: string): string[] =>
  html
    .split('role="option"')
    .slice(1)
    .map((row) => row.match(/font-mono[^>]*>([^<]*)</)?.[1] ?? '')

describe('MentionAutocomplete render (AC6 · AC19 · AC25)', () => {
  it('renders the path header and rows before the Plugin header and rows', () => {
    const html = markup('@j', [JIRA], [{ name: 'jira.md', isDirectory: false }])
    expect(html.indexOf('>./<')).toBeLessThan(html.indexOf('chat.composer.mentionPlugins'))
    expect(options(html)).toEqual(['jira.md', '@jira-dc'])
  })

  it('marks the flattened index across groups — the last option is the Plugin row', () => {
    const html = markup('@j', [JIRA], [{ name: 'jira.md', isDirectory: false }], 1)
    const selected = html
      .split('role="option"')
      .slice(1)
      .map((row) => row.includes('aria-selected="true"'))
    expect(selected).toEqual([false, true])
  })

  it('shows "no matches" instead of an empty header when both groups are empty', () => {
    const rootEmpty = markup('@zzz', [], [{ name: 'README.md', isDirectory: false }])
    const slashEmpty = markup('@src/zzz', [], [])
    for (const html of [rootEmpty, slashEmpty]) {
      expect(html).toContain('chat.composer.noMatches')
      expect(options(html)).toEqual([])
      expect(html).not.toContain('>./')
    }
  })

  it('shows the spinner, not "no matches", while the listing is pending', () => {
    const html = markup('@a', [], undefined, 0, true)
    expect(html).toContain('chat.composer.loadingShort')
    expect(html).not.toContain('chat.composer.noMatches')
  })
})
