export interface PlanSelectionOffsets {
  start: number
  end: number
  quote: string
}

export interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
}

interface IndexedText {
  node: Text
  start: number
  end: number
}

interface TextBlock {
  element: Element
  start: number
  end: number
}

export interface PlanCommentIndex {
  text: string
  blocks: readonly TextBlock[]
  selection(selection: Selection): PlanSelectionOffsets | null
  range(start: number, end: number): Range | null
  rects(start: number, end: number, origin: DOMRect, visible: readonly TextBlock[]): OverlayRect[]
}

const BLOCK_ELEMENTS = 'p,li,pre,td,th,h1,h2,h3,h4,h5,h6,dt,dd'

// The text and DOM boundaries use UTF-16 offsets, matching Range and String.slice.
export function createPlanCommentIndex(root: HTMLElement): PlanCommentIndex {
  const spans = new WeakMap<Node, { start: number; end: number }>()
  const entries: IndexedText[] = []
  const blocks: TextBlock[] = []
  const chunks: string[] = []
  let offset = 0
  function visit(node: Node, block: Element): void {
    const start = offset
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).matches(BLOCK_ELEMENTS)) {
      block = node as Element
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      offset += text.length
      if (offset > start) {
        entries.push({ node: text, start, end: offset })
        chunks.push(text.data)
        const previous = blocks.at(-1)
        if (previous?.element === block) previous.end = offset
        else blocks.push({ element: block, start, end: offset })
      }
    } else {
      for (const child of node.childNodes) visit(child, block)
    }
    spans.set(node, { start, end: offset })
  }
  visit(root, root)
  const text = chunks.join('')

  function offsetOf(node: Node, local: number): number | null {
    const span = spans.get(node)
    if (!span) return null
    if (node.nodeType === Node.TEXT_NODE) return span.start + local
    const child = node.childNodes.item(local)
    return child ? (spans.get(child)?.start ?? null) : span.end
  }

  function firstAfter(position: number): number {
    let low = 0
    let high = entries.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (entries[mid].end <= position) low = mid + 1
      else high = mid
    }
    return low
  }

  return {
    text,
    blocks,
    selection(selection) {
      if (!selection.rangeCount || selection.isCollapsed) return null
      const range = selection.getRangeAt(0)
      const start = offsetOf(range.startContainer, range.startOffset)
      const end = offsetOf(range.endContainer, range.endOffset)
      if (start === null || end === null || start >= end) return null
      const quote = text.slice(start, end)
      return quote.trim() ? { start, end, quote } : null
    },
    range(start, end) {
      if (start < 0 || start >= end || end > text.length) return null
      const first = entries[firstAfter(start)]
      const last = entries[firstAfter(end - 1)]
      if (!first || !last) return null
      const range = root.ownerDocument.createRange()
      range.setStart(first.node, start - first.start)
      range.setEnd(last.node, end - last.start)
      return range
    },
    rects(start, end, origin, visible) {
      if (start < 0 || start >= end || end > text.length) return []
      const rects: OverlayRect[] = []
      const range = root.ownerDocument.createRange()
      for (const block of visible) {
        const from = Math.max(block.start, start)
        const to = Math.min(block.end, end)
        if (from >= to) continue
        for (
          let index = firstAfter(from);
          index < entries.length && entries[index].start < to;
          index++
        ) {
          const entry = entries[index]
          const begin = Math.max(from, entry.start)
          const segment = text.slice(begin, Math.min(to, entry.end))
          if (!segment.trim()) continue
          range.setStart(entry.node, begin - entry.start + segment.search(/\S/))
          range.setEnd(entry.node, begin - entry.start + segment.trimEnd().length)
          for (const rect of range.getClientRects()) {
            if (rect.width > 0 && rect.height > 0) {
              rects.push({
                top: rect.top - origin.top,
                left: rect.left - origin.left,
                width: rect.width,
                height: rect.height
              })
            }
          }
        }
      }
      return rects
    }
  }
}
