import { describe, expect, it } from 'vitest'
import { initialSessionState, transition } from './session-state'

describe('session-state', () => {
  it('tracks cold -> live -> busy -> live without persistence', () => {
    let s = initialSessionState()
    expect(s.state).toBe('cold')
    s = transition(s, { type: 'open' })
    expect(s.state).toBe('live')
    s = transition(s, { type: 'send.start' })
    expect(s.state).toBe('busy')
    s = transition(s, { type: 'send.terminal' })
    expect(s).toEqual({ state: 'live', abortCause: null })
  })

  it('preserves abort cause while interrupting', () => {
    const s = transition(transition(initialSessionState(), { type: 'send.start' }), {
      type: 'interrupt',
      cause: 'stall'
    })
    expect(s).toEqual({ state: 'interrupting', abortCause: 'stall' })
  })

  it('closed is absorbing', () => {
    const closed = transition(initialSessionState(), { type: 'close' })
    expect(transition(closed, { type: 'send.start' })).toBe(closed)
  })
})
