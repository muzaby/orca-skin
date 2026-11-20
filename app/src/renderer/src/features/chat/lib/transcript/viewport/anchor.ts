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
  readonly charOffset: number
  /** Distance from the viewport's top edge (wrapperTop - viewportTop) at capture time. */
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

function findBlockWrapperByKey(scrollEl: HTMLElement, blockKey: string): HTMLElement | null {
  const candidates = scrollEl.querySelectorAll('[data-block-key]')
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i] as HTMLElement
    if (el.getAttribute('data-block-key') === blockKey) return el
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
  let targetTop = Infinity

  for (let i = 0; i < partElements.length; i++) {
    const el = partElements[i] as HTMLElement
    const rect = el.getBoundingClientRect()
    // First part overlapping or below viewport top edge
    if (rect.bottom > vpTop) {
      targetEl = el
      targetTop = rect.top
      break
    }
  }
  if (!targetEl) return null

  const partKey = targetEl.getAttribute('data-part-key') ?? ''
  const blockEl = (targetEl.closest?.('[data-index]') ??
    targetEl.closest?.('[data-block-key]')) as HTMLElement | null
  const blockKey = blockEl?.getAttribute('data-block-key') ?? partKey
  const messageId = blockEl?.getAttribute('data-message-id') ?? undefined

  let charOffset = 0
  let anchorScreenTop = targetTop

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
    if (pos && targetEl.contains(pos.offsetNode)) {
      resolvedCaret = { node: pos.offsetNode, offset: pos.offset }
    }
  }

  if (resolvedCaret && targetEl.contains(resolvedCaret.node)) {
    charOffset = partTextOffset(targetEl, resolvedCaret.node, resolvedCaret.offset)
    anchorScreenTop = measureCharTop(targetEl, charOffset)
  }

  return {
    partKey,
    blockKey,
    messageId,
    charOffset,
    viewportOffsetPx: anchorScreenTop - vpTop
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

  // Fallback a5: same message next part → next block
  if (blocks && blocks.length > 0) {
    // 1. Try another part in the same message
    if (anchor.messageId) {
      for (const b of blocks) {
        if (b.messageId !== anchor.messageId) continue
        for (const pk of b.partKeys) {
          const el = findPartWrapperByKey(scrollEl, pk)
          if (el) {
            const delta = el.getBoundingClientRect().top - (vpTop + anchor.viewportOffsetPx)
            return scrollEl.scrollTop + delta
          }
        }
      }
    }
    // 2. Try the block itself or the next available mounted block
    const blockEl = findBlockWrapperByKey(scrollEl, anchor.blockKey)
    if (blockEl) {
      const delta = blockEl.getBoundingClientRect().top - (vpTop + anchor.viewportOffsetPx)
      return scrollEl.scrollTop + delta
    }
    for (const b of blocks) {
      const el = findBlockWrapperByKey(scrollEl, b.blockKey)
      if (el) {
        const delta = el.getBoundingClientRect().top - (vpTop + anchor.viewportOffsetPx)
        return scrollEl.scrollTop + delta
      }
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
