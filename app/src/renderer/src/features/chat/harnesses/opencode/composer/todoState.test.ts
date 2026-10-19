import { describe, expect, it } from 'vitest'
import { emptyTodoDock, summarizeTodos, updateTodoDock, type TodoDockInput } from './todoState'

const todo = (status: string, text = status): { text: string; status: string } => ({ text, status })
const input = (patch: Partial<TodoDockInput> = {}): TodoDockInput => ({
  key: 'A:1',
  todos: [todo('pending')],
  live: true,
  blocked: false,
  reducedMotion: false,
  ...patch
})

describe('OpenCode todo state', () => {
  it('counts completed only and treats unknown as unfinished', () => {
    expect(summarizeTodos([todo('completed'), todo('cancelled')])).toMatchObject({
      completed: 1,
      terminal: true
    })
    for (const status of ['pending', 'in_progress', 'unknown', '']) {
      expect(summarizeTodos([todo(status)])).toMatchObject({ completed: 0, terminal: false })
    }
    expect(summarizeTodos([])).toMatchObject({
      completed: 0,
      terminal: false,
      representative: undefined
    })
  })
  it('chooses in progress, pending, last completed, then first item for the summary', () => {
    expect(
      summarizeTodos([todo('pending'), todo('in_progress', 'first'), todo('in_progress', 'second')])
        .representative?.text
    ).toBe('first')
    expect(
      summarizeTodos([todo('cancelled'), todo('pending', 'first'), todo('pending', 'second')])
        .representative?.text
    ).toBe('first')
    expect(
      summarizeTodos([todo('completed', 'first'), todo('completed', 'last'), todo('cancelled')])
        .representative?.text
    ).toBe('last')
    expect(summarizeTodos([todo('unknown', 'first'), todo('cancelled')]).representative?.text).toBe(
      'first'
    )
  })
  it('retains the last snapshot on idle/empty and delays terminal closure for 400ms', () => {
    const open = updateTodoDock(emptyTodoDock('A:1'), input())
    const closing = updateTodoDock(open, input({ todos: [todo('completed'), todo('cancelled')] }))
    expect(closing).toMatchObject({ phase: 'closing', closeDelay: 400 })
    expect(updateTodoDock(closing, input({ todos: closing.snapshot }))).toBe(closing)
    const idle = updateTodoDock(closing, input({ todos: [], live: false }))
    expect(idle).toMatchObject({ phase: 'closing', closeDelay: 0, snapshot: closing.snapshot })
  })
  it('cancels closure for new unfinished work and clears the snapshot on session/turn changes', () => {
    const open = updateTodoDock(emptyTodoDock('A:1'), input())
    const close = updateTodoDock(open, input({ todos: [todo('completed')] }))
    expect(updateTodoDock(close, input({ todos: [todo('pending', 'new')] }))).toMatchObject({
      phase: 'open',
      closeDelay: null,
      snapshot: [todo('pending', 'new')]
    })
    for (const key of ['A:2', 'B:1']) {
      expect(updateTodoDock(close, input({ key, todos: [] }))).toMatchObject({
        key,
        phase: 'hidden',
        snapshot: []
      })
    }
  })
  it('hides during requests, restores current unfinished work and removes immediately for reduced motion', () => {
    const open = updateTodoDock(emptyTodoDock('A:1'), input())
    const blocked = updateTodoDock(open, input({ blocked: true }))
    expect(blocked.phase).toBe('hidden')
    expect(blocked.snapshot).toEqual(open.snapshot)
    expect(updateTodoDock(blocked, input()).phase).toBe('open')
    expect(
      updateTodoDock(open, input({ todos: [todo('completed')], reducedMotion: true }))
    ).toEqual(emptyTodoDock('A:1'))
    expect(updateTodoDock(emptyTodoDock('A:1'), input({ todos: [todo('completed')] }))).toEqual(
      emptyTodoDock('A:1')
    )
  })
})
