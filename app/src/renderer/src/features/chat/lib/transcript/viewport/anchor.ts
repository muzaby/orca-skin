/**
 * Top-displacement scroll anchor capture, restoration, fallback, and cancellation (EP-12 · a1~a12).
 *
 * Uses `partTextOffset` and `pointAtPartOffset` so character position inside a `[data-part-key]`
 * wrapper is preserved across prepends, block merges/splits, width reflows, and multi-frame measurement corrections.
 */
import { partTextOffset, pointAtPartOffset } from './textOffset'

export interface AnchorTarget {
  readonly partKey: string
  readonly blockKey: string
  readonly messageId?: string
  /** Mounted successors in the previous layout, before a reset removes the reading position. */
  readonly followingPartKeys: readonly string[]
  readonly followingBlockKeys: readonly string[]
  readonly precedingBlockKeys: ReadonlySet<string>
  readonly blockIndex: number
  readonly partIndex: number
  readonly charOffset: number
  /** Distance from the viewport top to the captured character (or the part top for non-text). */
  readonly viewportOffsetPx: number
}

export interface AnchorFallbackEntry {
  readonly blockKey: string
  readonly messageId?: string
  readonly partKeys: readonly string[]
}

export interface AnchorController {
  captureAnchor(
    scrollEl: HTMLElement,
    caretPoint?: { node: Node; offset: number } | null
  ): AnchorTarget | null
  restoreAnchor(
    scrollEl: HTMLElement,
    anchor: AnchorTarget,
    blocks?: readonly AnchorFallbackEntry[]
  ): number | null
  cancelAnchor(): void
  getActiveAnchor(): AnchorTarget | null
  setActiveAnchor(anchor: AnchorTarget | null): void
}

function findPartWrapperByKey(scrollEl: HTMLElement, partKey: string): HTMLElement | null {
  const candidates = scrollEl.querySelectorAll('[data-part-key]')
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i] as HTMLElement
    if (el.getAttribute('data-part-key') === partKey) return el
  }
  return null
}

function measureCharTop(wrapper: HTMLElement, charOffset: number): number {
  const point = pointAtPartOffset(wrapper, charOffset)
  if (
    typeof document !== 'undefined' &&
    typeof document.createRange === 'function' &&
    point.node.nodeType === 3
  ) {
    try {
      const range = document.createRange()
      const len = (point.node as Text).data?.length ?? 0
      const start = Math.min(point.offset, len)
      range.setStart(point.node, start)
      range.setEnd(point.node, Math.min(start + 1, len))
      const rect = range.getBoundingClientRect()
      if (rect && (rect.height > 0 || rect.top !== 0)) {
        return rect.top
      }
    } catch {
      // Fallback to wrapper bounding rect in fake DOM environments
    }
  }
  return wrapper.getBoundingClientRect().top
}

export function captureAnchor(
  scrollEl: HTMLElement,
  caretPoint?: { node: Node; offset: number } | null
): AnchorTarget | null {
  const vpRect = scrollEl.getBoundingClientRect()
  const vpTop = vpRect.top
  const partElements = scrollEl.querySelectorAll('[data-part-key]')
  let targetEl: HTMLElement | null = null

  for (let i = 0; i < partElements.length; i++) {
    const el = partElements[i] as HTMLElement
    const rect = el.getBoundingClientRect()
    // First part overlapping or below viewport top edge
    if (rect.bottom > vpTop) {
      targetEl = el
      break
    }
  }
  if (!targetEl) return null

  let charOffset = 0

  let resolvedCaret = caretPoint
  if (
    resolvedCaret === undefined &&
    typeof document !== 'undefined' &&
    typeof (
      document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number
        ) => { offsetNode: Node; offset: number } | null
      }
    ).caretPositionFromPoint === 'function'
  ) {
    const pos = (
      document as Document & {
        caretPositionFromPoint: (
          x: number,
          y: number
        ) => { offsetNode: Node; offset: number } | null
      }
    ).caretPositionFromPoint(vpRect.left + Math.min(24, vpRect.width / 2), vpTop + 2)
    if (pos) resolvedCaret = { node: pos.offsetNode, offset: pos.offset }
  }

  if (resolvedCaret) {
    const element =
      resolvedCaret.node.nodeType === 1
        ? (resolvedCaret.node as Element)
        : resolvedCaret.node.parentElement
    const caretPart = element?.closest?.<HTMLElement>('[data-part-key]')
    if (caretPart && scrollEl.contains(caretPart)) {
      targetEl = caretPart
    }
  }
  if (resolvedCaret && targetEl.contains(resolvedCaret.node)) {
    charOffset = partTextOffset(targetEl, resolvedCaret.node, resolvedCaret.offset)
  }

  const partKey = targetEl.getAttribute('data-part-key') ?? ''
  const blockEl = targetEl.closest?.('[data-index]') ?? targetEl.closest?.('[data-block-key]')
  const messageId = blockEl?.getAttribute('data-message-id') ?? undefined
  const followingPartKeys = new Set<string>()
  const followingBlockKeys = new Set<string>()
  const precedingParts = new Set<string>()
  const precedingBlockKeys = new Set<string>()
  let passed = false
  for (const part of partElements) {
    if (part === targetEl) passed = true
    const block = part.closest('[data-index]') ?? part.closest('[data-block-key]')
    const key = part.getAttribute('data-part-key')!
    const blockKey = block?.getAttribute('data-block-key')
    if (!passed) {
      if (block !== blockEl && blockKey) precedingBlockKeys.add(blockKey)
      if (block === blockEl && key !== partKey) precedingParts.add(key)
      continue
    }
    if (key !== partKey && messageId && block?.getAttribute('data-message-id') === messageId) {
      followingPartKeys.add(key)
    }
    if (block !== blockEl && blockKey) followingBlockKeys.add(blockKey)
  }
  return {
    partKey,
    blockKey: blockEl?.getAttribute('data-block-key') ?? partKey,
    messageId,
    followingPartKeys: [...followingPartKeys],
    followingBlockKeys: [...followingBlockKeys],
    precedingBlockKeys,
    blockIndex: Number(blockEl?.getAttribute('data-index') ?? 0),
    partIndex: precedingParts.size,
    charOffset,
    viewportOffsetPx: measureCharTop(targetEl, charOffset) - vpTop
  }
}

/**
 * Compute the new `scrollTop` needed to keep `anchor` at its captured `viewportOffsetPx`.
 * Returns `null` if no target or fallback element is mounted.
 * Fallback order (a5): exact `partKey` → next part of same message → next block.
 */
export function restoreAnchor(
  scrollEl: HTMLElement,
  anchor: AnchorTarget,
  fallback?: readonly AnchorFallbackEntry[] | (() => readonly AnchorFallbackEntry[])
): number | null {
  const vpTop = scrollEl.getBoundingClientRect().top
  const exact = findPartWrapperByKey(scrollEl, anchor.partKey)
  if (exact) {
    const currentScreenTop = measureCharTop(exact, anchor.charOffset)
    const delta = currentScreenTop - (vpTop + anchor.viewportOffsetPx)
    return scrollEl.scrollTop + delta
  }

  const blocks = typeof fallback === 'function' ? fallback() : fallback

  if (blocks) {
    const mounted = (attribute: string): Map<string, HTMLElement> => {
      const byKey = new Map<string, HTMLElement>()
      for (const element of scrollEl.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
        const key = element.getAttribute(attribute)!
        if (!byKey.has(key)) byKey.set(key, element)
      }
      return byKey
    }
    const fallbackTop = (element: HTMLElement): number =>
      scrollEl.scrollTop + element.getBoundingClientRect().top - vpTop - anchor.viewportOffsetPx
    const parts = mounted('data-part-key')
    const rows = mounted('data-block-key')
    for (const key of anchor.followingPartKeys) {
      const part = parts.get(key)
      if (part) return fallbackTop(part)
    }
    const originalBlock = blocks.find((entry) => entry.blockKey === anchor.blockKey)
    for (const key of originalBlock?.partKeys.slice(anchor.partIndex) ?? []) {
      const part = parts.get(key)
      if (part) return fallbackTop(part)
    }
    // Locate the old reading slot relative to surviving predecessors after a prepend.
    let firstCandidate = 0
    let foundPredecessor = false
    for (const [index, entry] of blocks.entries()) {
      if (entry.blockKey === anchor.blockKey || anchor.precedingBlockKeys.has(entry.blockKey)) {
        firstCandidate = index + 1
        foundPredecessor = true
      }
    }
    const candidates = blocks
      .slice(firstCandidate)
      .filter(
        (entry, offset) =>
          foundPredecessor ||
          Number(rows.get(entry.blockKey)?.getAttribute('data-index') ?? offset) >=
            anchor.blockIndex
      )
    for (const entry of candidates) {
      if (!anchor.messageId || entry.messageId !== anchor.messageId) continue
      for (const key of entry.partKeys) {
        const part = parts.get(key)
        if (part) return fallbackTop(part)
      }
    }
    for (const key of anchor.followingBlockKeys) {
      const row = rows.get(key)
      if (row) return fallbackTop(row)
    }
    // No captured successor survived. A newly mounted replacement at the slot is usable.
    for (const entry of candidates) {
      const row = rows.get(entry.blockKey)
      if (row) return fallbackTop(row)
    }
  }

  return null
}

export function createAnchorController(): AnchorController {
  let active: AnchorTarget | null = null
  return {
    captureAnchor(scrollEl, caretPoint) {
      active = captureAnchor(scrollEl, caretPoint)
      return active
    },
    restoreAnchor(scrollEl, anchor, blocks) {
      return restoreAnchor(scrollEl, anchor, blocks)
    },
    cancelAnchor() {
      active = null
    },
    getActiveAnchor() {
      return active
    },
    setActiveAnchor(anchor) {
      active = anchor
    }
  }
}
