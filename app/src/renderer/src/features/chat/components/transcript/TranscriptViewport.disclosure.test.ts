import { createElement, useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { createBlockList } from '../../lib/transcript/blockList'
import {
  clearDisclosures,
  clearFocusRecord,
  getDisclosure,
  recordFocus,
  restoreFocusIfEligible,
  setDisclosure,
  setDisclosureActiveSession
} from '../../store/disclosureStore'
import { TranscriptViewport, type ViewportBlockBase } from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

interface DiscBlock extends ViewportBlockBase {
  readonly label: string
}

function makeBlocks(n: number): DiscBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `a:${i}:tool:t${i}`,
    messageId: `a:${i}`,
    partKeys: [`a:${i}:tool:t${i}`],
    label: `Tool ${i}`
  }))
}

function DisclosureCard({
  sessionKey,
  blockKey,
  label
}: {
  sessionKey: string
  blockKey: string
  label: string
}): ReturnType<typeof createElement> {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const setBtnRef = (el: HTMLButtonElement | null): void => {
    btnRef.current = el
  }
  const open = getDisclosure(sessionKey, blockKey)
  useEffect(() => {
    if (btnRef.current) {
      restoreFocusIfEligible(sessionKey, blockKey, btnRef.current as unknown as HTMLElement)
    }
  }, [sessionKey, blockKey])

  return createElement(
    'div',
    { 'data-card-key': blockKey, 'data-open': String(open) },
    createElement(
      'button',
      // eslint-disable-next-line react-hooks/refs
      {
        ref: setBtnRef,
        type: 'button',
        'data-toggle': blockKey,
        'data-focus-id': 'toggle',
        onFocus: () => recordFocus(sessionKey, blockKey, 'toggle'),
        onClick: () => setDisclosure(sessionKey, blockKey, !open)
      },
      label
    ),
    open ? createElement('div', { 'data-card-body': blockKey }, `Body of ${label}`) : null
  )
}

function makeScroller(scrollTop = 0): HTMLDivElement {
  const listeners = new Map<string, Set<EventListener>>()
  const el = {
    scrollTop,
    scrollHeight: 8000,
    clientHeight: 320,
    clientWidth: 600,
    getBoundingClientRect: () => ({ top: 0, bottom: 320, left: 0, width: 600, height: 320 }),
    addEventListener: (type: string, fn: EventListener) => {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(fn)
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn)
    },
    dispatchEvent: (ev: Event) => {
      listeners.get(ev.type)?.forEach((fn) => fn(ev))
      return true
    },
    querySelectorAll: () => [],
    scrollTo: ({ top }: { top?: number }) => {
      if (typeof top === 'number') el.scrollTop = top
    }
  } as unknown as HTMLDivElement
  return el
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  clearDisclosures('s-disc')
  clearFocusRecord()
})

describe('TranscriptViewport.disclosure (VP-28b · MD-13 ↔ IT-07 · EP-15)', () => {
  it('restores expansion and focus after virtualization remount without stealing focus moved elsewhere', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    setDisclosureActiveSession('s-disc')
    const blocks = makeBlocks(100)
    const snap = createBlockList(blocks).snapshot()
    const scroller = makeScroller(0)
    const scrollRef = { current: scroller }

    const renderWithComposer = (): void => {
      dom!.render(
        createElement(
          'div',
          null,
          createElement(TranscriptViewport<DiscBlock>, {
            snapshot: snap,
            scrollRef,
            overscan: 2,
            estimateSizePx: 80,
            renderBlock: (b) =>
              createElement(DisclosureCard, {
                sessionKey: 's-disc',
                blockKey: b.key,
                label: b.label
              })
          }),
          createElement('textarea', { 'data-composer': 'true' })
        )
      )
    }

    const scrollTo = (top: number): void => {
      scroller.scrollTop = top
      scroller.dispatchEvent(new Event('scroll'))
      renderWithComposer()
    }

    // 1. Mount at top: block 0 is visible; expand it and record focus on its toggle button
    renderWithComposer()
    const targetKey = blocks[0].key
    setDisclosure('s-disc', targetKey, true)
    recordFocus('s-disc', targetKey, 'toggle')
    renderWithComposer()
    expect(dom.query(`[data-card-body="${targetKey}"]`)).not.toBeNull()

    // 2. Scroll far away so block 0 virtualizes out; focus falls to document.body
    dom.body.focus()
    scrollTo(4000)
    expect(dom.query(`[data-card-key="${targetKey}"]`)).toBeNull()

    // 3. Scroll back to top: block 0 remounts -> expansion restored AND focus restored to toggle
    scrollTo(0)
    expect(dom.query(`[data-card-body="${targetKey}"]`)).not.toBeNull()
    const restoredBtn = dom.query(`[data-toggle="${targetKey}"]`)!
    expect(document.activeElement).toBe(restoredBtn)

    // 4. Now scroll away again, move focus to composer, and scroll back -> MUST NOT steal focus from composer!
    recordFocus('s-disc', targetKey, 'toggle')
    scrollTo(4000)
    const composer = dom.query('[data-composer="true"]')!
    composer.focus()
    expect(document.activeElement).toBe(composer)

    scrollTo(0)
    expect(dom.query(`[data-card-body="${targetKey}"]`)).not.toBeNull()
    expect(document.activeElement).toBe(composer)
  })
})
