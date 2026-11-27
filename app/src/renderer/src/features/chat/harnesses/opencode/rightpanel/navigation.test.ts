import { expect, it } from 'vitest'
import { openCodePanelFallbackOrigin } from './navigation'
it('does not borrow a fallback from outside the originating summary', () => {
  expect(openCodePanelFallbackOrigin()).toBeUndefined()
  const origin = { closest: () => null } as unknown as HTMLElement
  expect(openCodePanelFallbackOrigin(origin)).toBeUndefined()
  const emptySummary = {
    closest: () => ({ querySelector: () => null })
  } as unknown as HTMLElement
  expect(openCodePanelFallbackOrigin(emptySummary)).toBeUndefined()
})
