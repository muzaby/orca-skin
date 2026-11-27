import { expect, it } from 'vitest'
import { headInView, historyPull } from './historyPull'

it('includes the exact head boundary and an unscrollable viewport', () => {
  expect([0, 31, 32, 33].map((top) => headInView(top, 600, 300, 32))).toEqual([
    true,
    true,
    true,
    false
  ])
  expect(headInView(0, 200, 300, 32)).toBe(true)
})

it('opens on additional upward input while loading and holds until settlement', () => {
  expect(historyPull(false, 'ready', true, -12)).toBe(false)
  expect(historyPull(false, 'loading', false, -12)).toBe(false)
  expect(historyPull(false, 'loading', true, 12)).toBe(false)
  expect(historyPull(false, 'loading', true, -12)).toBe(true)
  expect(historyPull(true, 'loading', true, -12)).toBe(true)
  expect(historyPull(true, 'loading', true, 0)).toBe(true)
  for (const state of ['end', 'error', 'ready', undefined] as const)
    expect(historyPull(true, state, true, -12)).toBe(false)
})
