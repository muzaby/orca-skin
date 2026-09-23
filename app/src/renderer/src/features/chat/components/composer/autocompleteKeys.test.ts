import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { handleAutocompleteKey, type KeyboardAutocomplete } from './autocompleteKeys'
import {
  flattenMentionGroups,
  groupMentionSuggestions,
  parseMentionToken,
  type MentionSuggestion
} from '../../lib/mentionAutocomplete'

// 경로 그룹 + Plugin 그룹 두 header 아래 옵션 3개 — header는 flatten 배열에 없어야 한다.
function mentionOptions(): MentionSuggestion[] {
  const token = parseMentionToken('@j', 2)
  if (!token) throw new Error('expected mention token')
  const groups = groupMentionSuggestions(
    token,
    [{ kind: 'plugin', id: 'jira-dc', label: 'Jira' }],
    [
      { name: 'jira.md', isDirectory: false },
      { name: 'jobs', isDirectory: true }
    ]
  )
  expect(groups.map((group) => group.kind)).toEqual(['path', 'plugin'])
  return flattenMentionGroups(groups)
}

interface FakeAutocomplete<T> extends KeyboardAutocomplete<T> {
  setActiveIndex: ReturnType<typeof vi.fn<(index: number) => void>>
  close: ReturnType<typeof vi.fn<() => void>>
}

function fake<T>(suggestions: readonly T[], activeIndex: number): FakeAutocomplete<T> {
  return {
    suggestions,
    activeIndex,
    setActiveIndex: vi.fn<(index: number) => void>(),
    close: vi.fn<() => void>()
  }
}

describe('handleAutocompleteKey (AC11)', () => {
  it('↑/↓ wrap over options only — the two group headers take no index', () => {
    const options = mentionOptions()
    expect(options).toHaveLength(3)
    const last = fake(options, 2)
    expect(handleAutocompleteKey('ArrowDown', last, vi.fn())).toBe(true)
    expect(last.setActiveIndex).toHaveBeenCalledExactlyOnceWith(0)
    const first = fake(options, 0)
    expect(handleAutocompleteKey('ArrowUp', first, vi.fn())).toBe(true)
    expect(first.setActiveIndex).toHaveBeenCalledExactlyOnceWith(2)
    const middle = fake(options, 1)
    handleAutocompleteKey('ArrowDown', middle, vi.fn())
    expect(middle.setActiveIndex).toHaveBeenCalledExactlyOnceWith(2)
  })

  it.each(['Enter', 'Tab'])(
    '%s applies the active option of its own kind, not the first',
    (key) => {
      const options = mentionOptions()
      const pick = vi.fn()
      const list = fake(options, 2)
      expect(handleAutocompleteKey(key, list, pick)).toBe(true)
      expect(pick).toHaveBeenCalledExactlyOnceWith(options[2])
      expect(options[2]).toMatchObject({ kind: 'plugin', id: 'jira-dc' })
      expect(list.close).not.toHaveBeenCalled()
    }
  )

  it('Escape closes without applying', () => {
    const pick = vi.fn()
    const list = fake(mentionOptions(), 1)
    expect(handleAutocompleteKey('Escape', list, pick)).toBe(true)
    expect(list.close).toHaveBeenCalledTimes(1)
    expect(pick).not.toHaveBeenCalled()
  })

  it('with zero options, keys are still consumed but nothing moves or applies', () => {
    const pick = vi.fn()
    const empty = fake<MentionSuggestion>([], 0)
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Tab']) {
      expect(handleAutocompleteKey(key, empty, pick)).toBe(true)
    }
    expect(empty.setActiveIndex).not.toHaveBeenCalled()
    expect(pick).not.toHaveBeenCalled()
  })

  it('other keys fall through to the composer', () => {
    const list = fake(mentionOptions(), 0)
    expect(handleAutocompleteKey('a', list, vi.fn())).toBe(false)
    expect(list.setActiveIndex).not.toHaveBeenCalled()
    expect(list.close).not.toHaveBeenCalled()
  })

  it('the controller routes each open popup to its own list and apply callback', () => {
    const source = readFileSync(new URL('./ComposerInputController.tsx', import.meta.url), 'utf8')
    const calls = [...source.matchAll(/handleAutocompleteKey\(([^)]*)\)/g)].map((match) =>
      match[1].replace(/\s+/g, ' ').trim()
    )
    expect(calls).toEqual([
      'event.key, autocomplete, applyAutocomplete',
      'event.key, mentionAutocomplete, applyMentionAutocomplete'
    ])
    expect(source).toMatch(/skillOpen && handleAutocompleteKey\(/)
    expect(source).toMatch(/mentionOpen &&\s+handleAutocompleteKey\(/)
  })
})
