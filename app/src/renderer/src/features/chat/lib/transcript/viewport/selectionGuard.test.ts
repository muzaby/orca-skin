import { describe, expect, it } from 'vitest'
import {
  gestureReducer,
  isSuppressed,
  shouldCancelSelection,
  type GestureEvent,
  type GestureState,
  type SelectionPlace
} from './selectionGuard'

const places: SelectionPlace[] = ['none', 'outside', 'inside', 'dragging']

describe('selectionGuard (0326 ΔV2 · VP-42 · EP-25)', () => {
  it('u1: a new row key cancels only inside or dragging selections', () => {
    const previousKeys = new Set(['a', 'b'])
    expect(
      places.map((selection) =>
        shouldCancelSelection({ previousKeys, nextKeys: ['a', 'b', 'c'], selection })
      )
    ).toEqual([false, false, true, true])
  })

  it('u2: the same key set in another order is not a mount', () => {
    expect(
      shouldCancelSelection({
        previousKeys: new Set(['a', 'b', 'c']),
        nextKeys: ['c', 'a', 'b'],
        selection: 'inside'
      })
    ).toBe(false)
  })

  it('u3: removing rows without a new row does not cancel (B30)', () => {
    expect(
      shouldCancelSelection({
        previousKeys: new Set(['a', 'b', 'c']),
        nextKeys: ['a'],
        selection: 'inside'
      })
    ).toBe(false)
  })

  it('u4: gesture transitions for every state and event', () => {
    const states: GestureState[] = ['idle', 'dragging', 'suppressed']
    const events: GestureEvent[] = [
      { type: 'pointerdown', button: 0 },
      { type: 'cancel' },
      { type: 'pointerup' },
      { type: 'pointercancel' },
      { type: 'blur' }
    ]
    expect(states.map((state) => events.map((event) => gestureReducer(state, event)))).toEqual([
      ['dragging', 'idle', 'idle', 'idle', 'idle'],
      ['dragging', 'suppressed', 'idle', 'idle', 'idle'],
      ['suppressed', 'suppressed', 'idle', 'idle', 'idle']
    ])
  })

  it('u5: a secondary-button pointerdown does not start a drag', () => {
    expect(gestureReducer('idle', { type: 'pointerdown', button: 2 })).toBe('idle')
  })

  it('u6: only the suppressed state suppresses selection', () => {
    expect((['idle', 'dragging', 'suppressed'] as const).map(isSuppressed)).toEqual([
      false,
      false,
      true
    ])
  })

  it('u7: after a suppressed gesture is released the next drag starts normally', () => {
    let state: GestureState = 'idle'
    for (const event of [
      { type: 'pointerdown', button: 0 },
      { type: 'cancel' },
      { type: 'pointerup' },
      { type: 'pointerdown', button: 0 }
    ] as GestureEvent[])
      state = gestureReducer(state, event)
    expect(state).toBe('dragging')
  })
})
