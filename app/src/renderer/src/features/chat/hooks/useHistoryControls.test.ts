import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { useHistoryControls } from './useHistoryControls'

const state = vi.hoisted(() => ({
  sessions: {} as Record<
    string,
    {
      history?: {
        before?: { kind: 'earlierTurn' | 'withinTurn'; cursor: string }
        beforeState?: 'loading' | 'error'
      }
    }
  >,
  readPrevious: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../store/chatStore', () => ({
  useChatStore: (select: (s: typeof state) => unknown) => select(state),
  chatActions: { readPrevious: state.readPrevious }
}))

it('requests one same-turn page after commit and idle, pauses during input and stops at the previous turn, errors or unmount', () => {
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
  const commit = (entry: (typeof state.sessions)[string]): void => {
    state.sessions = { s: entry }
    dom.render(createElement(Controls))
  }
  const within = { kind: 'withinTurn' as const, cursor: 'within' }
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
  } finally {
    dom.render(null)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})
