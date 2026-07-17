import { describe, expect, it } from 'vitest'
import { isSessionOpening } from './sessionOpening'

describe('isSessionOpening', () => {
  it('keeps an ordinary first turn opening only until session promotion', () => {
    expect(isSessionOpening({ inflight: true, sessionId: null, userTurnCount: 1 })).toBe(true)
    expect(isSessionOpening({ inflight: true, sessionId: 's1', userTurnCount: 1 })).toBe(false)
  })

  it('keeps a handoff opening through promotion until its compact turn ends', () => {
    expect(
      isSessionOpening({
        inflight: true,
        sessionId: 's2',
        handoffFrom: 's1',
        userTurnCount: 1
      })
    ).toBe(true)
    expect(
      isSessionOpening({
        inflight: false,
        sessionId: 's2',
        handoffFrom: 's1',
        userTurnCount: 1
      })
    ).toBe(false)
  })

  it('uses the normal stop action for the first real handoff user turn', () => {
    expect(
      isSessionOpening({
        inflight: true,
        sessionId: 's2',
        handoffFrom: 's1',
        userTurnCount: 2
      })
    ).toBe(false)
  })
})
