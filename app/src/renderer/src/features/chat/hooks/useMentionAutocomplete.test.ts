import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileEntry, FileFolderChanged, ProviderInfo } from '../../../../../shared/ipc'

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
  folderChanged: null as ((change: FileFolderChanged) => void) | null,
  onFolderChanged: vi.fn(),
  onHostLifecycle: vi.fn(),
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
  fileApi: { list: h.list, onFolderChanged: h.onFolderChanged },
  hostApi: { onLifecycle: h.onHostLifecycle },
  providerApi: { state: h.providerState, onState: h.onState }
}))

import { useMentionAutocomplete, type UseMentionAutocomplete } from './useMentionAutocomplete'

// 컴포저가 넘기는 뒤쪽 두 인자(플러그인 후보 포함 여부 · 세션에서 관측한 플러그인).
const probe: { includePlugins?: boolean; observed?: readonly { id: string; label: string }[] } = {}

function HookProbe(
  text: string,
  caret: number,
  cwd: string | null,
  active: boolean
): UseMentionAutocomplete {
  return useMentionAutocomplete(
    text,
    caret,
    cwd,
    active,
    probe.includePlugins,
    probe.observed?.map((plugin) => ({ kind: 'plugin' as const, ...plugin }))
  )
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
    authScheme: 'login-required',
    origin: 'builtin',
    auth: [],
    status: 'valid',
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
  h.onFolderChanged.mockImplementation((listener: (change: FileFolderChanged) => void) => {
    h.folderChanged = listener
    return () => {
      h.folderChanged = null
    }
  })
  h.onHostLifecycle.mockReturnValue(() => {})
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
  it('refreshes on focus and data reconnection and resets off-menu tokens when cwd changes', async () => {
    const events = new EventTarget()
    vi.stubGlobal('addEventListener', events.addEventListener.bind(events))
    vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events))
    try {
      h.list.mockResolvedValue(Array.from({ length: 10 }, (_, i) => file('file' + i)))
      render('@file')
      await flush()
      const listing = render('@file')
      expect(listing.validFilePaths.has('file9')).toBe(true)
      expect(fileNames(listing)).toHaveLength(8)
      h.list.mockResolvedValue([file('file-focused')])
      events.dispatchEvent(new Event('focus'))
      await flush()
      expect(fileNames(render('@file'))).toEqual(['file-focused'])
      h.list.mockResolvedValue([file('file-reconnected')])
      h.onHostLifecycle.mock.calls.at(-1)![0]({ host: 'data' })
      await flush()
      expect(fileNames(render('@file'))).toEqual(['file-reconnected'])
      h.list.mockReturnValue(deferred().promise)
      expect(render('@file', '/other').validFilePaths.size).toBe(0)
    } finally {
      unmount()
      vi.unstubAllGlobals()
    }
  })
  it('keeps one pending listing across prefix/caret changes and filters its result using the current token', async () => {
    const request = deferred()
    h.list.mockReturnValue(request.promise)
    expect(render('@a')).toMatchObject({ open: true, loading: true, suggestions: [] })
    render('@al')
    render('@alp trailing', '/repo', 4)
    expect(h.list).toHaveBeenCalledExactlyOnceWith(
      '/repo',
      '',
      expect.objectContaining({ active: true })
    )
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
    h.list.mockImplementation((cwd, dir, { active }) =>
      !active
        ? Promise.resolve([])
        : cwd === '/other'
          ? other.promise
          : dir
            ? child.promise
            : root.promise
    )
    render('@a')
    render('@sub/')
    render('@sub/', '/other')
    expect(
      h.list.mock.calls.map(([cwd, dir, observation]) => [cwd, dir, observation.active])
    ).toEqual([
      ['/repo', '', true],
      ['/repo', '', false],
      ['/repo', 'sub', true],
      ['/repo', 'sub', false],
      ['/other', 'sub', true]
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

  it('cancels a removed token/unmounted owner and rechecks empty results when reopened', async () => {
    const stale = deferred()
    const empty = deferred()
    const unmounted = deferred()
    const openings = [stale.promise, empty.promise, unmounted.promise]
    h.list.mockImplementation((_cwd, _dir, { active }) =>
      active ? (openings.shift() ?? Promise.resolve([])) : Promise.resolve([])
    )
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
    expect(h.list.mock.calls.filter(([, , observation]) => observation.active)).toHaveLength(3)
    unmount()
    const before = h.states.map((slot) => slot.value)
    unmounted.resolve([file('discarded')])
    await unmounted.promise
    expect(h.states.map((slot) => slot.value)).toEqual(before)
  })

  it('coalesces invalidations during a read and keeps the selected file after an insertion', async () => {
    const first = deferred()
    const second = deferred()
    h.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    h.list.mockResolvedValue([file('aardvark'), file('alpha'), file('beta'), file('gamma')])
    render('@')
    first.resolve([file('alpha'), file('beta'), file('gamma')])
    await flush()
    render('@').setActiveIndex(1)
    h.folderChanged?.({ cwd: '/elsewhere', relDir: '', revision: 1 })
    expect(h.list).toHaveBeenCalledTimes(1)
    for (const revision of [1, 2, 3]) h.folderChanged?.({ cwd: '/repo', relDir: '', revision })
    expect(h.list).toHaveBeenCalledTimes(2)
    second.resolve([file('alpha'), file('beta'), file('gamma')])
    await flush()
    expect(h.list).toHaveBeenCalledTimes(3)
    const result = render('@')
    expect(fileNames(result)).toEqual(['aardvark', 'alpha', 'beta', 'gamma'])
    expect(fileNames(result)[result.activeIndex]).toBe('beta')
  })

  it('preserves quoted paths, the eight-item limit, and Escape dismissal/reopening', async () => {
    h.list.mockResolvedValue(Array.from({ length: 10 }, (_, i) => file(`file ${i}`)))
    const text = '@"some dir/f"'
    render(text, '/repo', text.length - 1)
    await flush()
    const current = render(text, '/repo', text.length - 1)
    expect(h.list).toHaveBeenCalledExactlyOnceWith(
      '/repo',
      'some dir',
      expect.objectContaining({ active: true })
    )
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
  it('removes invalid bindings from both menu and mention candidates', async () => {
    h.providerState.mockResolvedValue({
      providers: [
        provider('valid'),
        provider('none', { status: 'none' }),
        provider('expired', { status: 'expired' })
      ]
    })
    render('@', null)
    await flush()
    expect([...render('@', null).validPluginIds]).toEqual(['valid'])
    expect(render('@', null).plugins.map((entry) => entry.id)).toEqual(['valid'])
  })
  it('includes 로그인 프리 tools in @ candidates and validPluginIds (0248 AC13)', async () => {
    h.providerState.mockResolvedValue({
      providers: [
        provider('builtin-tools', { authScheme: 'login-free', origin: '', status: 'valid' })
      ]
    })
    render('@', null)
    await flush()
    const result = render('@', null)
    expect([...result.validPluginIds]).toEqual(['builtin-tools'])
    expect(result.suggestions).toEqual([
      { kind: 'plugin', id: 'builtin-tools', label: 'builtin-tools' }
    ])
    expect(result.open).toBe(true)
  })

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

  // 0259 r3 verify D6 · VP-07 — '+' 메뉴의 플러그인 목록은 입력 중인 `@` 접두와 무관한 전체 후보다.
  it('returns every Plugin candidate as plugins while an @ prefix narrows the suggestions', async () => {
    h.providerState.mockResolvedValue({
      providers: [
        provider('jira-dc', { label: 'Jira DC', status: 'valid' }),
        provider('confluence', { label: 'Confluence', status: 'valid' }),
        provider('gate', { tools: [] }),
        provider('linear', { label: 'Linear', status: 'valid' })
      ]
    })
    render('@ji', null)
    await flush()
    const result = render('@ji', null)
    expect(result.suggestions.map((item) => (item.kind === 'plugin' ? item.id : ''))).toEqual([
      'jira-dc'
    ])
    expect(result.plugins).toEqual([
      { kind: 'plugin', id: 'jira-dc', label: 'Jira DC' },
      { kind: 'plugin', id: 'confluence', label: 'Confluence' },
      { kind: 'plugin', id: 'linear', label: 'Linear' }
    ])
    expect(render('plain', null).plugins.map((plugin) => plugin.id)).toEqual([
      'jira-dc',
      'confluence',
      'linear'
    ])
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

  // 컴포저의 칩 판정은 이 집합 하나만 본다 — 세션에서 관측한 플러그인이 여기 없으면 칩이 풀린다.
  it('keeps observed plugins valid whether or not provider candidates are included', async () => {
    h.providerState.mockResolvedValue({ providers: [provider('linear')] })
    try {
      probe.observed = [{ id: 'native-only', label: 'Native' }]
      render('plain')
      await flush()
      expect([...render('plain').validPluginIds]).toEqual(['linear', 'native-only'])
      probe.includePlugins = false
      expect([...render('plain').validPluginIds]).toEqual(['native-only'])
      probe.observed = undefined
      expect([...render('plain').validPluginIds]).toEqual([])
    } finally {
      probe.includePlugins = undefined
      probe.observed = undefined
    }
  })
})
