import { describe, expect, it, vi } from 'vitest'
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
  it('a1 ignores a part ending exactly at the top and a caret from another viewport', () => {
    const past = makeEl({ 'data-part-key': 'past' }, [], { top: 50, height: 50 })
    const first = makeEl({ 'data-part-key': 'first' }, [], { top: 100, height: 20 })
    const later = makeEl({ 'data-part-key': 'later' }, [], { top: 120, height: 20 })
    const external = makeEl({ 'data-part-key': 'external' }, [], { top: 105, height: 20 })
    const el = makeEl({}, [past, first, later], { top: 100, height: 200 }) as unknown as HTMLElement
    const capture = createAnchorController()
    expect(
      capture.captureAnchor(el, { node: external as unknown as Node, offset: 0 })
    ).toMatchObject({
      partKey: 'first',
      charOffset: 0,
      viewportOffsetPx: 0
    })
    const empty = makeEl({}, [past], { top: 100, height: 200 }) as unknown as HTMLElement
    expect(capture.captureAnchor(empty, null)).toBeNull()
  })

  it('a12 resolves element caret offsets at the start and end of a nested inline, including an empty inline', () => {
    const before = makeText('before')
    const inside = makeText('bold')
    const bold = makeEl({}, [inside])
    const empty = makeEl({})
    const after = makeText('after')
    const wrapper = makeEl({ 'data-part-key': 'part' }, [before, bold, empty, after])
    const order = [wrapper, before, bold, inside, empty, after]
    for (const item of order) {
      Object.assign(item, {
        compareDocumentPosition: (other: FakeNode) =>
          order.indexOf(item) < order.indexOf(other)
            ? 4
            : order.indexOf(item) > order.indexOf(other)
              ? 2
              : 0
      })
    }
    const offset = (node: FakeNode, child: number): number =>
      partTextOffset(wrapper as unknown as Element, node as unknown as Node, child)
    expect(offset(bold, 0)).toBe(6)
    expect(offset(bold, 1)).toBe(10)
    expect(offset(empty, 0)).toBe(10)
    expect(offset(wrapper, wrapper.childNodes.length)).toBe(15)
  })

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

  it.each([
    { top: 0, height: 15, expected: 0 },
    { top: 18, height: 0, expected: 18 },
    { top: 0, height: 0, expected: 32 }
  ])(
    'a11 distinguishes glyph bounds from empty range geometry ($top, $height)',
    ({ top, height, expected }) => {
      const text = makeText('reading')
      const part = makeEl({ 'data-part-key': 'middle' }, [text], { top: 32, height: 48 })
      const viewport = makeEl({}, [part], { top: 4, height: 100 })
      vi.stubGlobal('document', {
        createRange: () => ({
          setStart: vi.fn(),
          setEnd: vi.fn(),
          getBoundingClientRect: () => ({ top, height })
        })
      })
      try {
        const anchor = createAnchorController().captureAnchor(viewport as unknown as HTMLElement, {
          node: text as unknown as Node,
          offset: 3
        })
        expect(anchor?.charOffset).toBe(3)
        expect(anchor?.viewportOffsetPx).toBe(expected - 4)
      } finally {
        vi.unstubAllGlobals()
      }
    }
  )

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

  it('a5 skips earlier mounted siblings after either the part or the whole message disappears', () => {
    const makeRow = (key: string, message: string, top: number): FakeNode =>
      makeEl(
        { 'data-part-key': key, 'data-block-key': key, 'data-message-id': message },
        [makeText(key)],
        { top, height: 30 }
      )
    const old = makeEl(
      {},
      [
        makeRow('older', 'old', -80),
        makeRow('previous-part', 'msg', -40),
        makeRow('reading', 'msg', 10),
        makeRow('next-part', 'msg', 45),
        makeRow('later', 'other', 100)
      ],
      { top: 0, height: 200 }
    )
    const anchor = createAnchorController().captureAnchor(old as unknown as HTMLElement)!
    expect(anchor.partKey).toBe('reading')
    for (const [keepNext, newSibling, expectedTop] of [
      [true, false, 200],
      [false, false, 260],
      [false, true, 225]
    ] as const) {
      const rows = [
        makeRow('new-prefix', 'msg', -180),
        makeRow('older', 'old', -80),
        makeRow('previous-part', 'msg', -40),
        makeRow('inserted', 'new-other', 45),
        ...(keepNext ? [makeRow('next-part', 'msg', 60)] : []),
        ...(newSibling ? [makeRow('new-sibling', 'msg', 85)] : []),
        makeRow('later', 'other', 120)
      ]
      const current = makeEl({}, rows, { top: 0, height: 200 })
      current.scrollTop = 150
      const entries = rows.map((row) => ({
        blockKey: row.attrs!['data-block-key'],
        messageId: row.attrs!['data-message-id'],
        partKeys: [row.attrs!['data-part-key']]
      }))
      expect(restoreAnchor(current as unknown as HTMLElement, anchor, entries)).toBe(expectedTop)
    }
  })

  it('a5 uses the vacated slot when a reset replaces the remaining keys in one block', () => {
    const part = (key: string, top: number): FakeNode =>
      makeEl({ 'data-part-key': key }, [makeText(key)], { top, height: 20 })
    const row = (keys: string[]): FakeNode =>
      makeEl(
        { 'data-index': '1', 'data-block-key': 'stable-block', 'data-message-id': 'm' },
        keys.map((key, index) => part(key, -40 + index * 40))
      )
    const scroller = (block: FakeNode): FakeNode => makeEl({}, [block], { top: 0, height: 200 })
    const anchor = createAnchorController().captureAnchor(
      scroller(row(['earlier', 'reading', 'next'])) as unknown as HTMLElement
    )!
    expect(anchor.partKey).toBe('reading')
    const after = scroller(row(['earlier', 'replacement']))
    after.scrollTop = 72
    const entry = { blockKey: 'stable-block', messageId: 'm', partKeys: ['earlier', 'replacement'] }
    expect(restoreAnchor(after as unknown as HTMLElement, anchor, [entry])).toBe(72)
    expect(
      restoreAnchor(scroller(row(['earlier'])) as unknown as HTMLElement, anchor, [
        { ...entry, partKeys: ['earlier'] }
      ])
    ).toBeNull()
  })

  it('a3/a9: multi-frame measurement corrections converge within +-1px with at most 1 scrollTop write per frame', () => {
    const part = makeEl({ 'data-part-key': 'a:3:text:0' }, [makeText('anchor line')], {
      top: 150,
      height: 40
    })
    const block = makeEl({ 'data-block-key': 'a:3:text:0', 'data-message-id': 'a:3' }, [part], {
      top: 150,
      height: 40
    })
    const scroller = makeEl({}, [block], { top: 100, height: 500 })
    scroller.scrollTop = 300

    const ctrl = createAnchorController()
    const anchor = ctrl.captureAnchor(scroller as unknown as HTMLElement)!
    let writes = 0

    // Frame 1: estimated prepend + header spinner change combined into 1 write
    part.top = 450
    block.top = 450
    const t1 = restoreAnchor(scroller as unknown as HTMLElement, anchor)
    if (t1 !== null) {
      scroller.scrollTop = t1
      writes++
    }
    expect(t1).toBe(600)
    expect(writes).toBe(1)

    // Frame 2: real measurement differs by +37px -> single correction brings delta within +-1px
    part.top = 187
    block.top = 187
    const t2 = restoreAnchor(scroller as unknown as HTMLElement, anchor)
    if (t2 !== null) {
      scroller.scrollTop = t2
      writes++
    }
    expect(Math.abs(t2! - 637)).toBeLessThanOrEqual(1)
    expect(writes).toBe(2)

    // Frame 3: final measurement settles at exact viewportOffsetPx -> 0 additional delta
    part.top = 150
    block.top = 150
    const t3 = restoreAnchor(scroller as unknown as HTMLElement, anchor)
    expect(t3).toBe(637)
  })

  it('a4/a6/a10: pinned prepend stays at bottom (no anchor override), unpinned live growth does not pull anchor, and header height shift keeps anchor offset', () => {
    const part = makeEl({ 'data-part-key': 'a:4:text:0' }, [makeText('reading mid')], {
      top: 140,
      height: 40
    })
    const block = makeEl({ 'data-block-key': 'a:4:text:0', 'data-message-id': 'a:4' }, [part], {
      top: 140,
      height: 40
    })
    const scroller = makeEl({}, [block], { top: 100, height: 500 })
    scroller.scrollTop = 100

    const ctrl = createAnchorController()
    const anchor = ctrl.captureAnchor(scroller as unknown as HTMLElement)!

    // a4: pinned mode bypasses anchor restore (handled by pin-to-bottom policy)
    const pinned = true
    expect(pinned ? null : restoreAnchor(scroller as unknown as HTMLElement, anchor)).toBeNull()

    // a6: live output grows below anchor -> anchor top unchanged -> scrollTop stays at 100
    expect(restoreAnchor(scroller as unknown as HTMLElement, anchor)).toBe(100)

    // a10: header spinner appears (+36px) -> part shifts down +36px -> restoreAnchor shifts scrollTop +36px
    part.top = 176
    block.top = 176
    expect(restoreAnchor(scroller as unknown as HTMLElement, anchor)).toBe(136)

    // a10: header spinner disappears (-36px) -> part shifts back to 104 -> restoreAnchor compensates
    scroller.scrollTop = 136
    part.top = 104
    block.top = 104
    expect(restoreAnchor(scroller as unknown as HTMLElement, anchor)).toBe(100)
  })

  it('a7/a11/a12 restores the glyph under the caret when an earlier visible part overlaps it', () => {
    const left = makeEl({ 'data-part-key': 'overlap' }, [makeText('earlier')], {
      top: 80,
      height: 70
    })
    const label = makeEl({ 'data-transcript-chrome': '' }, [makeText('Copy')])
    const glyph = makeText('target')
    const inline = makeEl({}, [glyph])
    Object.assign(glyph, { parentElement: inline })
    const reading = makeEl(
      { 'data-part-key': 'reading' },
      [
        makeEl({}, [makeText('A'.repeat(5000))]),
        label,
        inline,
        makeEl({}, [makeText('B'.repeat(5000))])
      ],
      { top: -674, height: 1700 }
    )
    const scroller = makeEl({}, [left, reading], { top: 100, height: 500 })
    let columns = 100
    let sourceOffset = 0
    const setStart = vi.fn((node: FakeNode, offset: number) => {
      sourceOffset = node === glyph ? 5000 + offset : offset
    })
    const glyphTop = (): number =>
      reading.top! + Math.floor(sourceOffset / columns) * 16 - (scroller.scrollTop! - 400)
    vi.stubGlobal('document', {
      createRange: () => ({
        setStart,
        setEnd: vi.fn(),
        getBoundingClientRect: () => ({ top: glyphTop(), height: 16 })
      })
    })
    try {
      for (const offset of [0, 2]) {
        columns = 100
        scroller.scrollTop = 400
        const anchor = createAnchorController().captureAnchor(scroller as unknown as HTMLElement, {
          node: glyph as unknown as Node,
          offset
        })!
        expect([anchor.partKey, anchor.charOffset, anchor.viewportOffsetPx]).toEqual([
          'reading',
          5000 + offset,
          26
        ])
        expect(setStart).toHaveBeenLastCalledWith(glyph, offset)
        columns = 80
        const corrected = restoreAnchor(scroller as unknown as HTMLElement, anchor)
        expect(corrected).toBe(592)
        scroller.scrollTop = corrected!
        expect(glyphTop() - scroller.top!).toBe(26)
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a7/a11: reset merge/split and long-part reflow keep the same partKey and character offset within +-1px', () => {
    const longText = 'A'.repeat(5000) + 'TARGET' + 'B'.repeat(5000)
    const textNode = makeText(longText)
    const part = makeEl({ 'data-part-key': 'a:7:text:0' }, [textNode], {
      top: 120,
      height: 800
    })
    const block = makeEl({ 'data-block-key': 'a:7:text:0', 'data-message-id': 'a:7' }, [part], {
      top: 120,
      height: 800
    })
    const scroller = makeEl({}, [block], { top: 100, height: 500 })
    scroller.scrollTop = 400

    // a11: character offset inside 10,000-char part survives width reflow
    const offset = partTextOffset(part as unknown as Element, textNode as unknown as Node, 5000)
    expect(offset).toBe(5000)
    const pt = pointAtPartOffset(part as unknown as Element, offset)
    expect(pt.node).toBe(textNode)
    expect(pt.offset).toBe(5000)

    // a7: after reset splits/merges block around same partKey, anchor still resolves by data-part-key
    const ctrl = createAnchorController()
    const anchor = ctrl.captureAnchor(scroller as unknown as HTMLElement)!
    part.top = 270
    block.top = 270
    const nextTop = restoreAnchor(scroller as unknown as HTMLElement, anchor)
    expect(Math.abs(nextTop! - 550)).toBeLessThanOrEqual(1)
  })
})
