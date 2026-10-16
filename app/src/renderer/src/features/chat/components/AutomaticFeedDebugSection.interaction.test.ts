import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { AutomaticFeedDebugSection } from './AutomaticFeedDebugSection'
import { getAutomaticFeedVisibility, setAutomaticFeedVisibility } from '../store/automaticFeedDebug'

vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return {
    ...actual,
    ...fakeHooks,
    useSyncExternalStore: (
      subscribe: (listener: () => void) => () => void,
      getSnapshot: () => unknown
    ) => {
      const [, update] = fakeHooks.useState(0) as [
        number,
        (next: (value: number) => number) => void
      ]
      fakeHooks.useEffect(() => subscribe(() => update((value) => value + 1)), [subscribe])
      return getSnapshot()
    }
  }
})
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
let dom: FakeDom
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('DEV', true)
  setAutomaticFeedVisibility(false)
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
})
afterEach(() => {
  dom.unmount()
  setAutomaticFeedVisibility(false)
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('updates the mounted native button through the actual memory subscription on each click', () => {
  dom.render(createElement(AutomaticFeedDebugSection))
  expect(dom.query('[data-debug-control="automatic-feed"]')?.props['aria-pressed']).toBe(false)
  dom.click(dom.query('[data-debug-control="automatic-feed"]')!)
  expect(getAutomaticFeedVisibility()).toBe(true)
  expect(dom.query('[data-debug-control="automatic-feed"]')?.props['aria-pressed']).toBe(true)
  dom.click(dom.query('[data-debug-control="automatic-feed"]')!)
  expect(getAutomaticFeedVisibility()).toBe(false)
  expect(dom.query('[data-debug-control="automatic-feed"]')?.props['aria-pressed']).toBe(false)
})

it('does not mount a button in production', () => {
  vi.stubEnv('DEV', false)
  dom.render(createElement(AutomaticFeedDebugSection))
  expect(dom.query('[data-debug-control="automatic-feed"]')).toBeNull()
})
