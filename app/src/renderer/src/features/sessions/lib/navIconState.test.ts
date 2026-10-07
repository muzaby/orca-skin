import { describe, expect, it } from 'vitest'
import { navIconState } from './navIconState'

describe('0254 nav icon priority', () => {
  for (const generating of [false, true]) {
    for (const attention of [undefined, 'completed', 'awaiting-response'] as const) {
      for (const isActive of [false, true]) {
        it(`generating=${generating} attention=${attention} active=${isActive}`, () => {
          const expected = generating
            ? 'in-progress'
            : isActive || attention === undefined
              ? 'default'
              : attention === 'completed'
                ? 'unseen-complete'
                : 'awaiting-response'
          expect(navIconState({ generating, attention, isActive })).toBe(expected)
        })
      }
    }
  }
})
