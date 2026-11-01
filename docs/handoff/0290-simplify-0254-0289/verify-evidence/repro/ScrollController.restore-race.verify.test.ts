// 0290 r1 verify 재현 — D2. app/src/renderer/src/features/chat/harnesses/opencode/transcript/ 로 복사해 실행한다:
//   cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.restore-race.verify.test.ts
// 관측(4d308eb): expected 200 to be 240 (사용자 스크롤이 대기 중 복원 프레임에 되돌려짐). 구현 전 ScrollController.tsx(a2e8464)로는 통과.
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import { OpenCodeScrollController } from './ScrollController'
import { timelineViewState } from './viewState'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('./scrollContext', () => ({
  TimelineScrollContext: { Provider: ({ children }: { children: unknown }) => children }
}))

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('VERIFY: keeps a user scroll that lands while a streaming resize restore is pending', () => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
  let resize = (): void => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe(): void {}
      disconnect(): void {}
    }
  )
  let top = 0
  const viewport = {
    dataset: {} as Record<string, string>,
    scrollHeight: 1000,
    clientHeight: 200,
    get scrollTop() {
      return top
    },
    set scrollTop(value: number) {
      top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight))
    },
    getBoundingClientRect: () => ({ top: 0, bottom: 200 }),
    querySelectorAll: () => [row],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  // A transcript row at content offset 300 — its viewport position follows scrollTop.
  const row = {
    dataset: { timelineKey: 'row' },
    parentElement: null,
    closest() {
      return this
    },
    getBoundingClientRect: () => ({ top: 300 - top, bottom: 350 - top })
  }
  let controls!: ScrollAnchor
  const state = timelineViewState('verify-scroll-race')
  state.setPinned(false)
  state.setTop(200)
  dom.render(
    createElement(OpenCodeScrollController, {
      sessionKey: 'verify-scroll-race',
      children: (scroll: ScrollAnchor) => {
        controls = scroll
        scroll.scrollRef.current = viewport as unknown as HTMLDivElement
        scroll.contentRef.current = {} as HTMLDivElement
        return null
      }
    })
  )
  expect(viewport.scrollTop).toBe(200)
  dom.act(() => controls.onScroll())
  dom.frame()
  // Streaming output grows below the reading position; the restore frame is queued.
  viewport.scrollHeight += 100
  resize()
  // The reader scrolls down 40px before that frame runs.
  dom.act(() => {
    viewport.scrollTop = 240
    controls.onScroll()
  })
  dom.frame()
  expect(viewport.scrollTop).toBe(240)
})
