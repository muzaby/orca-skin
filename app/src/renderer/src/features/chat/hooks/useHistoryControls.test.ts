import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { HistoryEdge } from '../../../../../shared/history-page'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useHistoryControls } from './useHistoryControls'

interface Paging {
  before?: HistoryEdge
  after?: HistoryEdge
  beforeState?: 'loading' | 'error'
  afterState?: 'loading' | 'error'
}
type Entry = { history?: Paging; search?: { view: Paging } }
const state = vi.hoisted(() => ({
  sessions: {} as Record<string, Entry>,
  readPrevious: vi.fn(),
  readSearchEdge: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../store/chatStore', () => ({
  useChatStore: (select: (s: typeof state) => unknown) => select(state),
  chatActions: { readPrevious: state.readPrevious, readSearchEdge: state.readSearchEdge }
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const within = { kind: 'withinTurn' as const, cursor: 'within' }
function setup(): {
  doc: EventTarget
  dom: ReturnType<typeof installFakeDom>
  idle: Map<number, () => void>
  tickIdle: () => void
  commit: (entry: Entry) => void
} {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const doc = new EventTarget()
  const win = new EventTarget()
  const idle = new Map<number, () => void>()
  let sequence = 0
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', {
    ...window,
    addEventListener: win.addEventListener.bind(win),
    removeEventListener: win.removeEventListener.bind(win),
    requestIdleCallback: (callback: () => void) => {
      idle.set(++sequence, callback)
      return sequence
    },
    cancelIdleCallback: (id: number) => idle.delete(id)
  })
  function tickIdle(): void {
    expect(idle.size).toBe(1)
    const [id, callback] = [...idle][0]
    idle.delete(id)
    callback()
  }
  function Controls(): null {
    useHistoryControls('s')
    return null
  }
  const commit = (entry: Entry): void => {
    state.sessions = { s: entry }
    dom.render(createElement(Controls))
  }
  return { doc, dom, idle, tickIdle, commit }
}
it('requests one same-turn page after commit and idle, pauses during input and stops at the previous turn, errors or unmount', () => {
  const { doc, dom, idle, tickIdle, commit } = setup()
  try {
    expect(idle.size).toBe(0)
    commit({})
    expect(idle.size).toBe(0)
    commit({ history: { before: within } })
    expect(state.readPrevious).not.toHaveBeenCalled()
    doc.dispatchEvent(new Event('pointerdown'))
    tickIdle()
    expect(state.readPrevious).not.toHaveBeenCalled()
    doc.dispatchEvent(new Event('pointerup'))
    vi.advanceTimersByTime(250)
    tickIdle()
    expect(state.readPrevious).toHaveBeenCalledExactlyOnceWith('s', true)
    commit({ history: { before: within, beforeState: 'loading' } })
    expect(idle.size).toBe(0)
    commit({ history: { before: { ...within, cursor: 'second' } } })
    tickIdle()
    expect(state.readPrevious).toHaveBeenCalledTimes(2)
    commit({ history: { before: { kind: 'earlierTurn', cursor: 'prior' } } })
    expect(idle.size).toBe(0)
    commit({ history: { before: within, beforeState: 'error' } })
    expect(idle.size).toBe(0)
    commit({ history: { before: within } })
    expect(idle.size).toBe(1)
    dom.render(null)
    expect(idle.size).toBe(0)
    commit({ history: { before: within } })
    doc.dispatchEvent(new Event('keydown'))
    tickIdle()
    dom.render(null)
    vi.advanceTimersByTime(250)
    expect(idle.size).toBe(0)
  } finally {
    dom.render(null)
  }
})

it.each(['wheel', 'keydown', 'pointerdown'])(
  'postpones idle history reads during %s input and resumes after release',
  (event) => {
    const { doc, dom, idle, tickIdle, commit } = setup()
    try {
      commit({ history: { before: within } })
      doc.dispatchEvent(new Event(event))
      if (event === 'pointerdown') vi.advanceTimersByTime(250)
      tickIdle()
      expect(state.readPrevious).not.toHaveBeenCalled()
      expect(idle.size).toBe(0)
      if (event === 'pointerdown') {
        vi.advanceTimersByTime(250)
        tickIdle()
        expect(state.readPrevious).not.toHaveBeenCalled()
        doc.dispatchEvent(new Event('pointerup'))
      }
      vi.advanceTimersByTime(250)
      tickIdle()
      expect(state.readPrevious).toHaveBeenCalledExactlyOnceWith('s', true)
    } finally {
      dom.unmount()
    }
  }
)

it('fills both sides of a search turn one committed page at a time', () => {
  const { dom, idle, tickIdle, commit } = setup()
  const before = { ...within, cursor: 'left' }
  const after = { ...within, cursor: 'right' }
  try {
    commit({ search: { view: { before, after } } })
    tickIdle()
    expect(state.readSearchEdge).toHaveBeenCalledExactlyOnceWith('s', 'before', true)
    for (const status of ['loading', 'error'] as const) {
      commit({ search: { view: { before, after, beforeState: status } } })
      expect(idle.size).toBe(0)
      commit({ search: { view: { before, after, afterState: status } } })
      expect(idle.size).toBe(0)
    }
    commit({ search: { view: { before: { kind: 'earlierTurn', cursor: 'previous' }, after } } })
    tickIdle()
    expect(state.readSearchEdge.mock.calls).toEqual([
      ['s', 'before', true],
      ['s', 'after', true]
    ])
    commit({
      search: {
        view: {
          before: { kind: 'earlierTurn', cursor: 'previous' },
          after: { kind: 'laterTurn', cursor: 'next' }
        }
      }
    })
    expect(idle.size).toBe(0)
    expect(state.readPrevious).not.toHaveBeenCalled()
  } finally {
    dom.unmount()
  }
})
