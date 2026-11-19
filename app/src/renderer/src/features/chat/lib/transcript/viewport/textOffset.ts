/**
 * Part-scoped text offset helpers shared by viewport anchor (EP-12 ①) and selection/copy (EP-17 ⑥).
 *
 * Traverses text nodes inside a `[data-part-key]` wrapper in document order while skipping
 * any descendant marked with `data-transcript-chrome` (copy button labels, tool card headers, line numbers).
 */

function isInsideChrome(node: Node, root: Element): boolean {
  let cur: Node | null = node.nodeType === 3 /* TEXT_NODE */ ? node.parentNode : node
  while (cur && cur !== root) {
    if (cur.nodeType === 1 /* ELEMENT_NODE */) {
      const el = cur as Element
      if (typeof el.hasAttribute === 'function' && el.hasAttribute('data-transcript-chrome')) {
        return true
      }
    }
    cur = cur.parentNode
  }
  return false
}

function collectContentTextNodes(root: Element): Text[] {
  const result: Text[] = []
  function walk(node: Node): void {
    if (node.nodeType === 1 /* ELEMENT_NODE */) {
      const el = node as Element
      if (
        el !== root &&
        typeof el.hasAttribute === 'function' &&
        el.hasAttribute('data-transcript-chrome')
      ) {
        return
      }
      const children = node.childNodes
      for (let i = 0; i < children.length; i++) {
        walk(children[i])
      }
    } else if (node.nodeType === 3 /* TEXT_NODE */) {
      result.push(node as Text)
    }
  }
  walk(root)
  return result
}

/**
 * Compute the character offset of `(node, offset)` relative to all non-chrome text inside `wrapper`.
 */
export function partTextOffset(wrapper: Element, node: Node, offset: number): number {
  if (isInsideChrome(node, wrapper)) return 0
  const textNodes = collectContentTextNodes(wrapper)
  let charOffset = 0

  if (node.nodeType === 3 /* TEXT_NODE */) {
    for (const tn of textNodes) {
      if (tn === node) {
        const len = tn.data?.length ?? tn.textContent?.length ?? 0
        return charOffset + Math.max(0, Math.min(offset, len))
      }
      charOffset += tn.data?.length ?? tn.textContent?.length ?? 0
    }
    return charOffset
  }

  // Element node: offset is child index
  const targetChild = node.childNodes[offset] ?? null
  for (const tn of textNodes) {
    if (targetChild) {
      // Check if tn is at or after targetChild in document order
      if (
        tn === targetChild ||
        (typeof targetChild.contains === 'function' && targetChild.contains(tn))
      ) {
        return charOffset
      }
      if (typeof tn.compareDocumentPosition === 'function') {
        const rel = targetChild.compareDocumentPosition(tn)
        // DOCUMENT_POSITION_FOLLOWING = 4
        if (rel & 4) return charOffset
      }
    }
    charOffset += tn.data?.length ?? tn.textContent?.length ?? 0
  }
  return charOffset
}

export interface PartTextPoint {
  readonly node: Node
  readonly offset: number
}

/**
 * Resolve a character offset `targetOffset` back to a `(Text, offset)` point inside `wrapper`,
 * skipping `[data-transcript-chrome]` subtrees. Clamps to the end if `targetOffset` exceeds total length.
 */
export function pointAtPartOffset(wrapper: Element, targetOffset: number): PartTextPoint {
  const clamped = Math.max(0, targetOffset)
  const textNodes = collectContentTextNodes(wrapper)
  if (textNodes.length === 0) {
    return { node: wrapper, offset: 0 }
  }
  let remaining = clamped
  for (const tn of textNodes) {
    const len = tn.data?.length ?? tn.textContent?.length ?? 0
    if (remaining <= len) {
      return { node: tn, offset: remaining }
    }
    remaining -= len
  }
  const last = textNodes[textNodes.length - 1]
  return { node: last, offset: last.data?.length ?? last.textContent?.length ?? 0 }
}
