import { describe, expect, it, vi } from 'vitest'
import { HISTORY_GESTURE_GAP_MS, HistoryGesture } from './historyGesture'

describe('history pull gesture and anchor cancellation', () => {
  it('consumes the momentum of a request across the reply and all 30 wheel events', () => {
    const gesture = new HistoryGesture()
    const request = vi.fn(() => true)
    expect(gesture.wheel(-5, 0, request)).toBe('started')
    for (let i = 1; i < 30; i++) expect(gesture.wheel(-8, i * 16, request)).toBe('consumedPull')
    expect(request.mock.calls).toEqual([['before']])
  })

  it('starts a new gesture on reversal, interruption, and at the gap boundary', () => {
    const gesture = new HistoryGesture()
    const request = vi.fn((direction: string) => direction === 'before')
    expect(gesture.wheel(-1, 0, request)).toBe('started')
    expect(gesture.wheel(1, 35, request)).toBe('userInput')
    expect(gesture.wheel(-1, 60, request)).toBe('started')
    gesture.interrupt()
    expect(gesture.wheel(-1, 70, request)).toBe('started')
    expect(gesture.wheel(-1, 70 + HISTORY_GESTURE_GAP_MS - 1, request)).toBe('consumedPull')
    expect(gesture.wheel(-1, 70 + HISTORY_GESTURE_GAP_MS * 2 - 1, request)).toBe('started')
    expect(request.mock.calls.flat()).toEqual(['before', 'after', 'before', 'before', 'before'])
  })

  it('honors an intervening user scroll without treating further momentum as a fresh request', () => {
    const gesture = new HistoryGesture()
    const request = vi.fn(() => true)
    expect(gesture.wheel(-1, 0, request)).toBe('started')
    gesture.userScroll()
    expect(gesture.wheel(-1, 35, request)).toBe('userInput')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps ordinary upward input ordinary even if the same flick reaches the edge', () => {
    const gesture = new HistoryGesture()
    const request = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    expect(gesture.wheel(-1, 0, request)).toBe('userInput')
    expect(gesture.wheel(-2, 16, request)).toBe('userInput')
    expect(gesture.wheel(0, 24, request)).toBe('userInput')
    expect(gesture.wheel(5, 32, request)).toBe('started')
    expect(request.mock.calls.flat()).toEqual(['before', 'after'])
  })
})
