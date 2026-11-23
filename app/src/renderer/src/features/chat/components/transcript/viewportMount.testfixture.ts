import { createElement } from 'react'
import { afterEach, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { createBlockList } from '../../lib/transcript/blockList'
import { installViewportSelection } from './viewportSelection.testfixture'
import { TranscriptViewport, setVirtualization, type ViewportBlockBase } from './TranscriptViewport'

interface SimpleBlock extends ViewportBlockBase {
  readonly text: string
}

export function makeBlocks(n: number, edit?: (i: number) => string): SimpleBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `a:${i}:text:0`,
    messageId: `a:${i}`,
    partKeys: [`a:${i}:text:0`],
    text: edit?.(i) ?? `Block ${i} line one`
  }))
}

export let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  setVirtualization(true)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** A mounted viewport over a fake scroller whose `scroll` listeners the test fires. */
interface ViewportHarness extends ReturnType<typeof installViewportSelection> {
  render(): void
  part(i: number): FakeNode
  mounted(): number[]
  viewport(): FakeNode
  scrollTo(top: number): void
  replace(next: SimpleBlock[]): void
  fireDocument(type: string): void
  selectionChange(): void
  pointerDown(button?: number): void
  setSession(key: string): void
}

export function mountViewport(
  count: number,
  options: { composer?: boolean; overscan?: number; nested?: () => React.ReactElement } = {}
): ViewportHarness {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  const sel = installViewportSelection(dom)
  let blocks = makeBlocks(count)
  let snapshot = createBlockList(blocks).snapshot()
  let sessionKey = 's'
  const scrollListeners = new Set<() => void>()
  const scroll = {
    scrollTop: 0,
    clientHeight: 240,
    clientWidth: 600,
    getBoundingClientRect: () => ({ top: 0, bottom: 240, width: 600, height: 240 }),
    querySelectorAll: (selector: string) => dom!.queryAll(selector),
    querySelector: (selector: string) => dom!.query(selector),
    contains: (node: Node) => dom!.body.contains(node),
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'scroll') scrollListeners.add(listener)
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'scroll') scrollListeners.delete(listener)
    },
    scrollTo: () => {}
  }
  const scrollRef = { current: scroll as unknown as HTMLDivElement }
  const render = (): void => {
    const viewport = createElement(TranscriptViewport<SimpleBlock>, {
      snapshot,
      sessionKey,
      scrollRef,
      overscan: options.overscan ?? 2,
      estimateSizePx: 80,
      renderBlock: (block, index, selected) =>
        createElement(
          'p',
          { 'data-picked': selected ? index : undefined },
          block.text,
          options.nested?.()
        )
    })
    dom!.render(
      options.composer
        ? createElement(
            'main',
            null,
            createElement('p', { 'data-composer': '' }, 'composer draft text'),
            viewport
          )
        : viewport
    )
  }
  render()
  return {
    ...sel,
    render,
    part: (i: number): FakeNode => dom!.query(`[data-part-key="${blocks[i].key}"]`)!,
    mounted: (): number[] =>
      dom!.queryAll('[data-index]').map((n) => Number(n.getAttribute('data-index'))),
    viewport: (): FakeNode => dom!.query('[data-transcript-viewport]')!,
    scrollTo(top: number): void {
      scroll.scrollTop = top
      dom!.act(() => {
        for (const listener of scrollListeners) listener()
      })
      render()
    },
    replace(next: SimpleBlock[]): void {
      blocks = next
      snapshot = createBlockList(next).snapshot()
      render()
    },
    fireDocument(type: string): void {
      dom!.act(() => {
        for (const listener of dom!.documentListeners.get(type) ?? []) listener({})
      })
    },
    selectionChange(): void {
      dom!.act(() => {
        for (const listener of dom!.documentListeners.get('selectionchange') ?? []) listener({})
      })
    },
    pointerDown(button = 0): void {
      const onPointerDown = dom!.query('[data-transcript-viewport]')!.props.onPointerDown as (e: {
        button: number
      }) => void
      dom!.act(() => onPointerDown({ button }))
    },
    setSession(key: string): void {
      sessionKey = key
      render()
    }
  }
}
