import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import {
  createBubbleMeasureCoordinator,
  getSharedBubbleMeasureCoordinator,
  resetSharedBubbleMeasureCoordinatorForTests,
  useBubbleOverflow
} from '../../../lib/bubbleMeasure'
import { UserBubbleText } from './UserBubbleText'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks,
  useId: () => 'bubble-content'
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../../../../shared/theme/TweakProvider', () => ({
  useOptionalTweak: () => ({ transcriptTextSize: 'medium', appFont: 'default' })
}))
vi.mock('../../../store/bubbleExpansionStore', () => ({ useBubbleExpanded: () => false }))
vi.mock('../../../components/transcript/TranscriptViewport', () => ({
  useTranscriptReveal: () => () => {}
}))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  resetSharedBubbleMeasureCoordinatorForTests()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('updates the mounted overflow toggle after content and observed width change on a frame', () => {
  vi.useFakeTimers()
  let height = 250
  let notify!: ResizeObserverCallback
  const observe = vi.fn()
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback
      }
      observe = observe
      unobserve = vi.fn()
      disconnect = disconnect
    }
  )
  vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '20px', fontSize: '16px' }))
  dom = installFakeDom({
    innerWidth: 600,
    innerHeight: 400,
    layout: () => ({ scrollHeight: height })
  })
  const render = (children: string): void =>
    dom!.render(createElement(UserBubbleText, null, children))
  const toggle = (): ReturnType<FakeDom['query']> => dom!.query('[data-behavior="bubble:toggle"]')

  render('first')
  expect(observe).toHaveBeenCalledTimes(1)
  expect(toggle()).toBeNull()
  dom.frame()
  expect(toggle()?.getAttribute('aria-expanded')).toBe('false')

  height = 80
  render('shorter content')
  dom.frame()
  expect(toggle()).toBeNull()

  height = 300
  const target = observe.mock.calls[0][0] as Element
  notify([{ target, contentRect: { width: 180 } } as ResizeObserverEntry], {} as ResizeObserver)
  expect(toggle()).toBeNull()
  dom.frame()
  expect(toggle()?.getAttribute('aria-expanded')).toBe('false')
  dom.unmount()
  expect(disconnect).toHaveBeenCalledTimes(1)
})

it('shares a coordinator across hooks and ignores a ref without a mounted bubble', () => {
  expect(getSharedBubbleMeasureCoordinator()).toBe(getSharedBubbleMeasureCoordinator())
  const coordinator = createBubbleMeasureCoordinator()
  const observe = vi.spyOn(coordinator, 'observe').mockImplementation(() => {})
  const update = vi.spyOn(coordinator, 'update').mockImplementation(() => {})
  const ref = { current: null }
  function Probe(): React.JSX.Element {
    const overflow = useBubbleOverflow(
      ref,
      { content: 'detached', scale: 1, bubbleVariant: '' },
      coordinator
    )
    return createElement('span', { 'data-overflow-probe': true }, String(overflow))
  }
  dom = installFakeDom({ innerWidth: 600, innerHeight: 400 })
  dom.render(createElement(Probe))
  expect(dom.query('[data-overflow-probe]')!.textContent).toBe('false')
  expect(observe).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})
