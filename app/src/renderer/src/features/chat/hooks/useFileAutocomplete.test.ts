import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '../../../../../shared/ipc'

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
vi.mock('../../../shared/api/ipc', () => ({ fileApi: { list: h.list } }))

import { useFileAutocomplete, type UseFileAutocomplete } from './useFileAutocomplete'

function HookProbe(text: string, cwd: string | null, caret: number): UseFileAutocomplete {
  return useFileAutocomplete(text, caret, cwd)
}

function render(
  text: string,
  cwd: string | null = '/repo',
  caret = text.length
): UseFileAutocomplete {
  for (let attempt = 0; attempt < 10; attempt++) {
    h.stateIndex = h.memoIndex = h.effectIndex = 0
    h.pending = []
    h.dirty = false
    const result = HookProbe(text, cwd, caret)
    // cwd changes reset state during render; only the final render commits effects.
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

const file = (name: string, isDirectory = false): FileEntry => ({ name, isDirectory })

beforeEach(() => {
  h.states = []
  h.memos = []
  h.effects = []
  h.pending = []
  h.list.mockReset()
})
afterEach(unmount)

describe('file autocomplete listing ownership', () => {
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
    expect(current.suggestions.map((entry) => entry.name)).toEqual(['alpha', 'alpine'])
    expect([...current.validPaths]).toEqual(['alpha', 'beta', '.hidden', 'alpine'])
    expect(render('@b').suggestions.map((entry) => entry.name)).toEqual(['beta'])
    expect(render('@.').suggestions.map((entry) => entry.name)).toEqual(['.hidden'])
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
    expect(current.suggestions.map((entry) => entry.name)).toEqual(['current'])
    expect([...current.validPaths]).toEqual(['sub/current'])
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
    expect([...render('plain').validPaths]).toEqual([])
    render('@')
    empty.resolve([])
    await empty.promise
    expect(render('@')).toMatchObject({ open: true, loading: false, suggestions: [] })
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
    await Promise.resolve()
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
    expect(render('@"some dir/fi').open).toBe(true)
  })
})
