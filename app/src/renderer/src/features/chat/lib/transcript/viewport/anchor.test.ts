import { describe, expect, it } from 'vitest'
import { partTextOffset, pointAtPartOffset } from './textOffset'
import { createAnchorController, restoreAnchor } from './anchor'

// Minimal fake DOM nodes for Node test environment
interface FakeNode {
  nodeType: number
  data?: string
  textContent?: string
  parentNode: FakeNode | null
  childNodes: FakeNode[]
  attrs?: Record<string, string>
  top?: number
  height?: number
  hasAttribute?: (name: string) => boolean
  getAttribute?: (name: string) => string | null
  contains?: (other: FakeNode) => boolean
  closest?: (selector: string) => FakeNode | null
  querySelectorAll?: (selector: string) => FakeNode[]
  getBoundingClientRect?: () => {
    top: number
    bottom: number
    left: number
    width: number
    height: number
  }
  scrollTop?: number
}

function makeText(text: string): FakeNode {
  return { nodeType: 3, data: text, textContent: text, parentNode: null, childNodes: [] }
}

function makeEl(
  attrs: Record<string, string> = {},
  children: FakeNode[] = [],
  rect = { top: 0, height: 40 }
): FakeNode {
  const el: FakeNode = {
    nodeType: 1,
    attrs,
    parentNode: null,
    childNodes: [],
    top: rect.top,
    height: rect.height,
    scrollTop: 0,
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(attrs, name),
    getAttribute: (name) => attrs[name] ?? null,
    contains(other) {
      let cur: FakeNode | null = other
      while (cur) {
        if (cur === el) return true
        cur = cur.parentNode
      }
      return false
    },
    closest(selector) {
      const attrMatch = selector.match(/^\[([^\]]+)\]$/)
      const attr = attrMatch?.[1]
      let cur: FakeNode | null = el
      while (cur) {
        if (attr && cur.hasAttribute?.(attr)) return cur
        cur = cur.parentNode
      }
      return null
    },
    querySelectorAll(selector) {
      const attrMatch = selector.match(/^\[([^\]]+)\]$/)
      const attr = attrMatch?.[1]
      const found: FakeNode[] = []
      function walk(n: FakeNode): void {
        if (n !== el && attr && n.hasAttribute?.(attr)) found.push(n)
        for (const c of n.childNodes) walk(c)
      }
      walk(el)
      return found
    },
    getBoundingClientRect: () => ({
      top: el.top ?? 0,
      bottom: (el.top ?? 0) + (el.height ?? 0),
      left: 0,
      width: 600,
      height: el.height ?? 0
    })
  }
  for (const child of children) {
    child.parentNode = el
    el.childNodes.push(child)
  }
  return el
}

describe('viewport/textOffset & anchor (EP-12 · a1~a12)', () => {
  it('a12: partTextOffset & pointAtPartOffset traverse inline elements and skip data-transcript-chrome', () => {
    const t1 = makeText('Hello ')
    const chromeBtn = makeEl({ 'data-transcript-chrome': '' }, [makeText('Copy')])
    const strongText = makeText('bold')
    const strong = makeEl({}, [strongText])
    const t2 = makeText(' world')
    const wrapper = makeEl({ 'data-part-key': 'a:1:text:0' }, [t1, chromeBtn, strong, t2])

    // "Hello " = 6 chars; chrome "Copy" is skipped; "bold" starts at 6; " world" starts at 10
    expect(partTextOffset(wrapper as unknown as Element, strongText as unknown as Node, 2)).toBe(8)
    expect(partTextOffset(wrapper as unknown as Element, t2 as unknown as Node, 1)).toBe(11)

    const p1 = pointAtPartOffset(wrapper as unknown as Element, 8)
    expect(p1.node).toBe(strongText)
    expect(p1.offset).toBe(2)

    const p2 = pointAtPartOffset(wrapper as unknown as Element, 11)
    expect(p2.node).toBe(t2)
    expect(p2.offset).toBe(1)

    // Clamping beyond length lands at end of last non-chrome text node
    const pEnd = pointAtPartOffset(wrapper as unknown as Element, 999)
    expect(pEnd.node).toBe(t2)
    expect(pEnd.offset).toBe(6)
  })

  it('a1/a2/a5/a8: captureAnchor → restoreAnchor compensates top displacement, falls back on missing partKey, and cancelAnchor clears state', () => {
    const part1 = makeEl({ 'data-part-key': 'a:2:text:0' }, [makeText('reading here')], {
      top: 120,
      height: 40
    })
    const block1 = makeEl({ 'data-block-key': 'a:2:text:0', 'data-message-id': 'a:2' }, [part1], {
      top: 120,
      height: 40
    })
    const scroller = makeEl({}, [block1], { top: 100, height: 500 })
    scroller.scrollTop = 200

    const ctrl = createAnchorController()
    const captured = ctrl.captureAnchor(scroller as unknown as HTMLElement)
    expect(captured).not.toBeNull()
    expect(captured!.partKey).toBe('a:2:text:0')
    expect(captured!.viewportOffsetPx).toBe(20)

    // Prepend shifts part1 down by +300px (top: 120 → 420)
    part1.top = 420
    block1.top = 420
    const nextTop = restoreAnchor(scroller as unknown as HTMLElement, captured!)
    expect(nextTop).toBe(500) // 200 + 300

    // a5: if captured partKey disappears, fallback picks next part of same message
    const part2 = makeEl({ 'data-part-key': 'a:2:text:1' }, [makeText('next part')], {
      top: 460,
      height: 40
    })
    const block2 = makeEl({ 'data-block-key': 'a:2:text:1', 'data-message-id': 'a:2' }, [part2], {
      top: 460,
      height: 40
    })
    const scroller2 = makeEl({}, [block2], { top: 100, height: 500 })
    scroller2.scrollTop = 200
    const fallbackTop = restoreAnchor(scroller2 as unknown as HTMLElement, captured!, [
      { blockKey: 'a:2:text:1', messageId: 'a:2', partKeys: ['a:2:text:1'] }
    ])
    expect(fallbackTop).toBe(540) // 200 + (460 - 120)

    // a8: cancelAnchor clears active anchor
    ctrl.cancelAnchor()
    expect(ctrl.getActiveAnchor()).toBeNull()
  })
})
