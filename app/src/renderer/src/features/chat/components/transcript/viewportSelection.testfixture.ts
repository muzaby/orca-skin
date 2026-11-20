import { vi } from 'vitest'
import type { FakeDom, FakeNode } from '../../../../shared/ui/renderHarness.testfixture'

interface Point {
  node: FakeNode
  offset: number
}

interface FakeRange {
  readonly start: Point
  readonly end: Point
  selectNodeContents(root: FakeNode): void
  setStart(node: FakeNode, offset: number): void
  setEnd(node: FakeNode, offset: number): void
  cloneContents(): string
}

interface FixtureSelection {
  readonly anchorNode: FakeNode | null
  readonly focusNode: FakeNode | null
  readonly anchorOffset: number
  readonly focusOffset: number
  readonly rangeCount: number
  readonly isCollapsed: boolean
  removeAllRanges(): void
  setBaseAndExtent(
    anchor: FakeNode,
    anchorOffset: number,
    focus: FakeNode,
    focusOffset: number
  ): void
  addRange(range: FakeRange): void
  toString(): string
}

function textNodes(root: FakeNode): FakeNode[] {
  if (root.hidden || root.getAttribute('class')?.split(' ').includes('select-none')) return []
  if (root.nodeType === 3) return [root]
  return root.children.flatMap(textNodes)
}

export function installViewportSelection(dom: FakeDom): {
  selection: FixtureSelection
  select(start: FakeNode, startOffset: number, end: FakeNode, endOffset: number): void
} {
  let anchor: Point | null = null
  let focus: Point | null = null

  function rangeText(start: Point, end: Point): string {
    const all = textNodes(dom.body)
    const left = all.indexOf(start.node)
    const right = all.indexOf(end.node)
    if (left < 0 || right < 0) throw new Error('Selection endpoint is outside selectable DOM')
    if (left > right || (left === right && start.offset > end.offset)) {
      return rangeText(end, start)
    }
    let text = ''
    let previousBlock: FakeNode | null = null
    for (let index = left; index <= right; index++) {
      const node = all[index]
      const block = node.closest('[data-block-key]')
      if (index > left && block !== previousBlock) text += '\n'
      text += node.text.slice(
        index === left ? start.offset : 0,
        index === right ? end.offset : undefined
      )
      previousBlock = block
    }
    return text
  }

  function createRange(): FakeRange {
    let start: Point
    let end: Point
    return {
      get start() {
        return start
      },
      get end() {
        return end
      },
      selectNodeContents(root: FakeNode) {
        const nodes = textNodes(root)
        start = { node: nodes[0], offset: 0 }
        const last = nodes.at(-1)!
        end = { node: last, offset: last.text.length }
      },
      setStart(node: FakeNode, offset: number) {
        start = { node, offset }
      },
      setEnd(node: FakeNode, offset: number) {
        end = { node, offset }
      },
      cloneContents() {
        return rangeText(start, end)
      }
    }
  }

  const selection = {
    get anchorNode() {
      return anchor?.node ?? null
    },
    get focusNode() {
      return focus?.node ?? null
    },
    get anchorOffset() {
      return anchor?.offset ?? 0
    },
    get focusOffset() {
      return focus?.offset ?? 0
    },
    get rangeCount() {
      return anchor && focus ? 1 : 0
    },
    get isCollapsed() {
      return anchor?.node === focus?.node && anchor?.offset === focus?.offset
    },
    removeAllRanges() {
      anchor = focus = null
    },
    setBaseAndExtent(
      anchorNode: FakeNode,
      anchorOffset: number,
      focusNode: FakeNode,
      focusOffset: number
    ) {
      anchor = { node: anchorNode, offset: anchorOffset }
      focus = { node: focusNode, offset: focusOffset }
    },
    addRange(range: ReturnType<typeof createRange>) {
      anchor = range.start
      focus = range.end
    },
    toString() {
      return anchor && focus ? rangeText(anchor, focus) : ''
    }
  }
  Object.assign(document, {
    getSelection: () => selection,
    createRange,
    createElement: () => ({
      innerHTML: '',
      appendChild(text: string) {
        this.innerHTML = text
      }
    })
  })
  vi.stubGlobal('CSS', { escape: (value: string) => value })

  function select(start: FakeNode, startOffset: number, end: FakeNode, endOffset: number): void {
    selection.setBaseAndExtent(textNodes(start)[0], startOffset, textNodes(end)[0], endOffset)
    dom.act(() => {
      for (const listener of dom.documentListeners.get('selectionchange') ?? []) listener({})
    })
  }

  return { selection, select }
}
