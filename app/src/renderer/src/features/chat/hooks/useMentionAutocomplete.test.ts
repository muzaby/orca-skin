import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileEntry, ProviderInfo } from '../../../../../shared/ipc'

// Drive the real hook's state, memo dependencies and effect cleanup. This is a deterministic
// hook fixture, not a browser/React scheduler implementation.
const h = vi.hoisted(() => ({
  states: [] as { value: unknown; set: (update: unknown) => void }[],
  memos: [] as { value: unknown; deps: readonly unknown[] }[],
  effects: [] as { deps: readonly unknown[]; cleanup: void | (() => void) }[],
  pending: [] as { index: number; run: () => void | (() => void); deps: readonly unknown[] }[],
  stateIndex: 0,
  memoIndex: 0,
  effectIndex: 0,
  dirty: false,
  list: vi.fn(),
  providerState: vi.fn(),
  onState: vi.fn(),
  off: vi.fn(),
  push: null as null | ((state: { providers: ProviderInfo[] }) => void),
  same: (a: readonly unknown[], b: readonly unknown[]): boolean =>
    a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = h.stateIndex++
    if (!h.states[index]) {
      const slot = {
        value: typeof initial === 'function' ? initial() : initial,
        set: (update: unknown): void => {
          const next = typeof update === 'function' ? update(slot.value) : update
          if (!Object.is(next, slot.value)) {
            slot.value = next
            h.dirty = true
          }
        }
      }
      h.states[index] = slot
    }
    const slot = h.states[index]
    return [slot.value, slot.set]
  },
  useMemo: (calculate: () => unknown, deps: readonly unknown[]) => {
    const index = h.memoIndex++
    const previous = h.memos[index]
    if (!previous || !h.same(previous.deps, deps)) {
      h.memos[index] = { value: calculate(), deps }
    }
    return h.memos[index].value
  },
  useEffect: (run: () => void | (() => void), deps: readonly unknown[]) => {
    const index = h.effectIndex++
    const previous = h.effects[index]
    if (!previous || !h.same(previous.deps, deps)) h.pending.push({ index, run, deps })
  }
}))
vi.mock('../../../shared/api/ipc', () => ({
  fileApi: { list: h.list },
  providerApi: { state: h.providerState, onState: h.onState }
}))

import { useMentionAutocomplete, type UseMentionAutocomplete } from './useMentionAutocomplete'

function HookProbe(
  text: string,
  caret: number,
  cwd: string | null,
  active: boolean
): UseMentionAutocomplete {
  return useMentionAutocomplete(text, caret, cwd, active)
}

function render(
  text: string,
  cwd: string | null = '/repo',
  caret = text.length,
  active = true
): UseMentionAutocomplete {
  for (let attempt = 0; attempt < 10; attempt++) {
    h.stateIndex = h.memoIndex = h.effectIndex = 0
    h.pending = []
    h.dirty = false
    const result = HookProbe(text, caret, cwd, active)
    // render-phase state resets re-run the render; only the final render commits effects.
    if (h.dirty) continue
    for (const effect of h.pending) {
      h.effects[effect.index]?.cleanup?.()
      h.effects[effect.index] = { deps: effect.deps, cleanup: effect.run() }
    }
    return result
  }
  throw new Error('Hook fixture did not settle')
}

function unmount(): void {
  for (const effect of h.effects) effect.cleanup?.()
  h.effects = []
}

function deferred(): { promise: Promise<FileEntry[]>; resolve: (entries: FileEntry[]) => void } {
  let resolve!: (entries: FileEntry[]) => void
  const promise = new Promise<FileEntry[]>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}

const file = (name: string, isDirectory = false): FileEntry => ({ name, isDirectory })
const fileNames = (result: UseMentionAutocomplete): string[] =>
  result.suggestions.flatMap((item) => (item.kind === 'file' ? [item.entry.name] : []))

function provider(id: string, overrides: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    id,
    label: id,
    kind: 'service',
    origin: 'builtin',
    auth: [],
    status: 'none',
    activeAuthKind: null,
    principal: null,
    expiresAt: null,
    tools: [`mcp__${id}-tools__search`],
    ...overrides
  }
}

beforeEach(() => {
  h.states = []
  h.memos = []
  h.effects = []
  h.pending = []
  h.push = null
  h.list.mockReset()
  h.providerState.mockReset()
  h.onState.mockReset()
  h.off.mockReset()
  h.providerState.mockResolvedValue({ providers: [] })
  h.onState.mockImplementation((listener: (state: { providers: ProviderInfo[] }) => void) => {
    h.push = listener
    return h.off
  })
})
afterEach(unmount)

describe('mention autocomplete path listing ownership', () => {
  it('keeps one pending listing across prefix/caret changes and filters its result using the current token', async () => {
    const request = deferred()
    h.list.mockReturnValue(request.promise)
    expect(render('@a')).toMatchObject({ open: true, loading: true, suggestions: [] })
    render('@al')
    render('@alp trailing', '/repo', 4)
    expect(h.list).toHaveBeenCalledExactlyOnceWith('/repo', '')
    request.resolve([file('alpha'), file('beta'), file('.hidden'), file('alpine')])
    await request.promise
    const current = render('@alp')
    expect(current.loading).toBe(false)
    expect(fileNames(current)).toEqual(['alpha', 'alpine'])
    expect([...current.validFilePaths]).toEqual(['alpha', 'beta', '.hidden', 'alpine'])
    expect(fileNames(render('@b'))).toEqual(['beta'])
    expect(fileNames(render('@.'))).toEqual(['.hidden'])
    expect(h.list).toHaveBeenCalledTimes(1)
  })

  it('replaces directory/cwd owners and excludes both previous owners late results', async () => {
    const root = deferred()
    const child = deferred()
    const other = deferred()
    h.list
      .mockReturnValueOnce(root.promise)
      .mockReturnValueOnce(child.promise)
      .mockReturnValueOnce(other.promise)
    render('@a')
    render('@sub/')
    render('@sub/', '/other')
    expect(h.list.mock.calls).toEqual([
      ['/repo', ''],
      ['/repo', 'sub'],
      ['/other', 'sub']
    ])
    other.resolve([file('current')])
    await other.promise
    root.resolve([file('old-root')])
    child.resolve([file('old-child')])
    await Promise.all([root.promise, child.promise])
    const current = render('@sub/', '/other')
    expect(fileNames(current)).toEqual(['current'])
    expect([...current.validFilePaths]).toEqual(['sub/current'])
    expect(current.loading).toBe(false)
  })

  it('cancels a removed token/unmounted owner and keeps empty results cached when reopened', async () => {
    const stale = deferred()
    const empty = deferred()
    const unmounted = deferred()
    h.list
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(empty.promise)
      .mockReturnValueOnce(unmounted.promise)
    render('@')
    expect(render('plain')).toMatchObject({ open: false, loading: false })
    stale.resolve([file('stale')])
    await stale.promise
    expect([...render('plain').validFilePaths]).toEqual([])
    render('@')
    empty.resolve([])
    await empty.promise
    // 결과 0건은 빈 그룹 없이 열린다 — popup은 이때 `일치하는 항목 없음`을 렌더한다.
    expect(render('@')).toMatchObject({ open: true, loading: false, suggestions: [], groups: [] })
    render('plain')
    render('@')
    expect(h.list).toHaveBeenCalledTimes(2)
    render('@new/')
    unmount()
    const before = h.states.map((slot) => slot.value)
    unmounted.resolve([file('discarded')])
    await unmounted.promise
    expect(h.states.map((slot) => slot.value)).toEqual(before)
  })

  it('preserves quoted paths, the eight-item limit, and Escape dismissal/reopening', async () => {
    h.list.mockResolvedValue(Array.from({ length: 10 }, (_, i) => file(`file ${i}`)))
    const text = '@"some dir/f"'
    render(text, '/repo', text.length - 1)
    await flush()
    const current = render(text, '/repo', text.length - 1)
    expect(h.list).toHaveBeenCalledExactlyOnceWith('/repo', 'some dir')
    expect(current).toMatchObject({
      quoted: true,
      hasClosingQuote: true,
      tokenStart: 0,
      loading: false
    })
    expect(current.suggestions).toHaveLength(8)
    current.setActiveIndex(7)
    expect(render(text, '/repo', text.length - 1).activeIndex).toBe(7)
    current.close()
    expect(render(text, '/repo', text.length - 1).open).toBe(false)
    render('plain')
    expect(render(text, '/repo', text.length - 1)).toMatchObject({ open: true, activeIndex: 0 })
    expect(render('@"some dir/fi').open).toBe(true)
  })

  it('shows no empty path group for a slash path without matches (AC25)', async () => {
    h.list.mockResolvedValue([file('index.ts')])
    render('@src/zzz')
    await flush()
    expect(render('@src/zzz')).toMatchObject({ open: true, loading: false, groups: [] })
  })
})

describe('mention autocomplete occurrence and dismissal (D-015 · AC11 · AC20)', () => {
  it('reopens after the whole draft is cleared and @ is typed again in the same composer', async () => {
    h.providerState.mockResolvedValue({ providers: [provider('jira-dc')] })
    h.list.mockResolvedValue([file('a.md')])
    render('@')
    await flush()
    const first = render('@')
    expect(first.open).toBe(true)
    first.close()
    expect(render('@').open).toBe(false)
    render('')
    expect(render('@')).toMatchObject({ open: true, activeIndex: 0 })
  })

  it('keeps a popup reopened by typing after Escape open when the active option moves', async () => {
    h.list.mockResolvedValue([file('alpha.md'), file('alpine.md')])
    render('@a')
    await flush()
    const dismissedAt = render('@a')
    dismissedAt.close()
    expect(render('@a').open).toBe(false)
    const reopened = render('@al')
    expect(reopened.open).toBe(true)
    reopened.setActiveIndex(1)
    expect(render('@al')).toMatchObject({ open: true, activeIndex: 1 })
  })

  it('restores Escape and option movement on a new occurrence after the token ended', async () => {
    h.list.mockResolvedValue([file('alpha.md'), file('alpine.md')])
    render('@a')
    await flush()
    render('@a').setActiveIndex(1)
    render('')
    const next = render('@a')
    expect(next.activeIndex).toBe(0)
    next.setActiveIndex(1)
    expect(render('@a').activeIndex).toBe(1)
    render('@a').close()
    expect(render('@a').open).toBe(false)
  })
})

describe('mention autocomplete provider sources (AC10 · AC19 · AC23)', () => {
  it('opens a Plugin-only popup without cwd and never lists files', async () => {
    h.providerState.mockResolvedValue({ providers: [provider('jira-dc')] })
    render('@', null)
    await flush()
    const result = render('@', null)
    expect(h.list).not.toHaveBeenCalled()
    expect(result.open).toBe(true)
    expect(result.groups.map((group) => group.kind)).toEqual(['plugin'])
  })

  it('keeps a quoted token closed without cwd even when Plugin ids match its prefix (AC9)', async () => {
    h.providerState.mockResolvedValue({ providers: [provider('jira-dc')] })
    render('@"j', null)
    await flush()
    const result = render('@"j', null)
    expect(h.list).not.toHaveBeenCalled()
    expect(result).toMatchObject({ open: false, quoted: true, groups: [] })
    // 같은 prefix의 plain token은 Plugin-only popup으로 열린다 — 닫힘은 quoted 때문이다.
    expect(render('@j', null)).toMatchObject({ open: true })
  })

  it('keeps path results when provider state fails, with one invoke and one subscription', async () => {
    h.providerState.mockRejectedValue(new Error('down'))
    h.list.mockResolvedValue([file('README.md')])
    render('@')
    await flush()
    render('@R')
    const result = render('@RE')
    expect(result.open).toBe(true)
    expect(result.groups.map((group) => group.kind)).toEqual(['path'])
    expect(h.providerState).toHaveBeenCalledTimes(1)
    expect(h.onState).toHaveBeenCalledTimes(1)
  })

  it('orders the path group before the Plugin group in groups and flattened options', async () => {
    h.providerState.mockResolvedValue({ providers: [provider('jira-dc')] })
    h.list.mockResolvedValue([file('jira.md')])
    render('@j')
    await flush()
    const result = render('@j')
    expect(result.groups.map((group) => group.kind)).toEqual(['path', 'plugin'])
    expect(result.suggestions.map((item) => item.kind)).toEqual(['file', 'plugin'])
  })

  it('derives chip ids from tools only — catalog without tools is not a Plugin', async () => {
    h.providerState.mockResolvedValue({
      providers: [
        provider('gate-with-catalog', {
          kind: 'gate',
          tools: [],
          catalog: { icon: 'language', title: { ko: '게이트', en: 'Gate' } }
        }),
        provider('plugin-without-catalog')
      ]
    })
    render('plain')
    await flush()
    expect([...render('plain').validPluginIds]).toEqual(['plugin-without-catalog'])
  })

  it('follows provider pushes and drops the subscription when inactive', async () => {
    render('plain')
    await flush()
    h.push?.({ providers: [provider('linear')] })
    expect([...render('plain').validPluginIds]).toEqual(['linear'])
    const inactive = render('plain', '/repo', 5, false)
    expect(h.off).toHaveBeenCalledTimes(1)
    expect([...inactive.validPluginIds]).toEqual([])
  })
})
