/**
 * Shared virtualized transcript viewport for Claude (code/work) and OpenCode (EP-10 · EP-11 · EP-12 · EP-17).
 *
 * - Single `useVirtualizer` instance across `features/chat` (EP-10 ①).
 * - `getItemKey` identity pinned to `snapshot.keyRevision` (D-073 · v1 · v2).
 * - `virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false` (EP-10 ③ · v3).
 * - Single `writeScrollTop` writer for all transcript scroll adjustments (EP-10 ②).
 * - Bounded selection mount via `selectionMountSet` + sync/chunked async copy via `CopySerializationHost` (EP-17).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject
} from 'react'
import { flushSync } from 'react-dom'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import type { BlockSnapshot } from '../../lib/transcript/blockList'
import { shouldScrollAfterCollapse } from '../../lib/bubbleCollapse'
import { selectionMountSet } from '../../lib/transcript/viewport/range'
import {
  SELECTION_COPY_SYNC_MAX_BLOCKS,
  startCopyJob,
  type CopyJobHandle,
  type CopyTaskTiming,
  type RetainedSelection
} from '../../lib/transcript/viewport/copy'
import { partTextOffset, pointAtPartOffset } from '../../lib/transcript/viewport/textOffset'
import { reserveGap } from '../../lib/transcript/viewport/reserve'
import {
  captureAnchor,
  createAnchorController,
  restoreAnchor,
  type AnchorTarget
} from '../../lib/transcript/viewport/anchor'
import { attachDiagnosticViewport, checkCopyChunk } from '../../dev/transcriptViewportDiagnostics'
import { CopySerializationHost } from './CopySerializationHost'

// --- Diagnostic virtualization toggle (EP-17 ⑧ · c17 · S5) ---
let virtualizationEnabled = true
const virtualizationListeners = new Set<() => void>()

// eslint-disable-next-line react-refresh/only-export-components
export function setVirtualization(enabled: boolean): void {
  if (virtualizationEnabled === enabled) return
  virtualizationEnabled = enabled
  for (const listener of virtualizationListeners) listener()
}

// eslint-disable-next-line react-refresh/only-export-components
export function isVirtualizationEnabled(): boolean {
  return virtualizationEnabled
}

function subscribeVirtualization(listener: () => void): () => void {
  virtualizationListeners.add(listener)
  return () => virtualizationListeners.delete(listener)
}

// --- Single scrollTop writer for all transcript scroll paths (EP-10 ②) ---
// eslint-disable-next-line react-refresh/only-export-components
export function writeScrollTop(element: HTMLElement, top: number, behavior?: 'smooth'): void {
  if (behavior === 'smooth') element.scrollTo({ top, behavior })
  else element.scrollTop = top
}

// eslint-disable-next-line react-refresh/only-export-components
export function revealElementInScrollParent(root: HTMLElement): void {
  let parent = root.parentElement
  while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) {
    parent = parent.parentElement
  }
  if (!parent) return
  const viewportTop = parent.getBoundingClientRect().top
  const top = root.getBoundingClientRect().top
  if (shouldScrollAfterCollapse(top, viewportTop)) {
    writeScrollTop(parent, parent.scrollTop + top - viewportTop)
  }
}

const TranscriptRevealContext = createContext<(element: HTMLElement) => void>(
  revealElementInScrollParent
)

// eslint-disable-next-line react-refresh/only-export-components
export function useTranscriptReveal(): (element: HTMLElement) => void {
  return useContext(TranscriptRevealContext)
}

export interface ViewportBlockBase {
  readonly key: string
  readonly messageId?: string
  readonly partKeys?: readonly string[]
  readonly reserveTarget?: boolean
}

export interface TranscriptViewportProps<Block extends ViewportBlockBase> {
  readonly snapshot: BlockSnapshot<Block>
  readonly sessionKey?: string
  readonly scrollRef: RefObject<HTMLDivElement | null>
  readonly hasPartMarkers?: (block: Block) => boolean
  readonly renderBlock: (block: Block, index: number, selected: boolean) => ReactNode
  readonly overscan?: number
  readonly estimateSizePx?: number
  readonly initialOffset?: number
  readonly sizeCache?: Map<string, number>
  /** When true, computes Claude 0008 reserveGap from the last block with `reserveTarget: true`. */
  readonly enableReserveGap?: boolean
  /** Optional header slot rendered above virtualized blocks (EP-12 ① · a9 · a10). */
  readonly header?: ReactNode
  /** Non-virtualized tail slot (pending steer, pending indicator, error banner, etc. — EP-11 ⑥). */
  readonly footer?: ReactNode
  /** When true (pinned to bottom), upward anchor restoration is skipped (EP-12 ⑥ · a4). */
  readonly isPinned?: () => boolean
  /** Optional anchor block key to keep mounted in rangeExtractor. */
  readonly anchorKey?: string | null
  /** Optional callback for copy task timings (used by tests & diagnostics). */
  readonly onCopyTiming?: (timing: CopyTaskTiming) => void
  /** Optional custom copy chunk size (tests). */
  readonly copyChunkSize?: number
  /** Optional className applied to each positioned block wrapper. */
  readonly itemClassName?: (block: Block, index: number) => string
}

function findEndpoint(node: Node | null, offset: number): RetainedSelection['anchor'] | null {
  if (!node) return null
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement
  if (!el) return null
  const partEl = el.closest?.('[data-part-key]') as HTMLElement | null
  const blockEl = (el.closest?.('[data-index]') ??
    el.closest?.('[data-block-key]')) as HTMLElement | null
  const blockKey = blockEl?.getAttribute('data-block-key')
  if (!blockKey) return null
  const partKey = partEl?.getAttribute('data-part-key') ?? blockKey
  const charOffset = partEl ? partTextOffset(partEl, node, offset) : offset
  return { blockKey, partKey, charOffset }
}

function selectionBlockIndex(
  snapshot: BlockSnapshot<ViewportBlockBase>,
  endpoint: RetainedSelection['anchor']
): number {
  const existingIndex = snapshot.indexOf(endpoint.blockKey)
  if (existingIndex >= 0) {
    const block = snapshot.blockAt(existingIndex)
    if (block.key === endpoint.partKey || block.partKeys?.includes(endpoint.partKey)) {
      return existingIndex
    }
  }
  const partIndex = snapshot.indexOf(endpoint.partKey)
  if (partIndex >= 0) return partIndex
  for (let index = 0; index < snapshot.count; index++) {
    if (snapshot.blockAt(index).partKeys?.includes(endpoint.partKey)) return index
  }
  return -1
}

function restoreSelection(
  root: HTMLElement,
  selection: Selection,
  retained: RetainedSelection
): void {
  const anchor = root.querySelector(`[data-part-key="${CSS.escape(retained.anchor.partKey)}"]`)
  const focus = root.querySelector(`[data-part-key="${CSS.escape(retained.focus.partKey)}"]`)
  if (!anchor || !focus) return
  const a = pointAtPartOffset(anchor, retained.anchor.charOffset)
  const f = pointAtPartOffset(focus, retained.focus.charOffset)
  if (
    a.node !== selection.anchorNode ||
    a.offset !== selection.anchorOffset ||
    f.node !== selection.focusNode ||
    f.offset !== selection.focusOffset
  ) {
    selection.setBaseAndExtent(a.node, a.offset, f.node, f.offset)
  }
}

const SHIFT_EXTEND_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End'
])

const SCROLL_CANCEL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' '
])

export function TranscriptViewport<Block extends ViewportBlockBase>({
  snapshot,
  sessionKey,
  scrollRef,
  renderBlock,
  hasPartMarkers,
  overscan = 6,
  estimateSizePx = 120,
  initialOffset,
  sizeCache: externalSizeCache,
  enableReserveGap = false,
  header,
  footer,
  isPinned,
  anchorKey,
  onCopyTiming,
  copyChunkSize,
  itemClassName
}: TranscriptViewportProps<Block>): React.JSX.Element {
  const virtualized = useSyncExternalStore(
    subscribeVirtualization,
    isVirtualizationEnabled,
    isVirtualizationEnabled
  )

  const internalSizes = useRef(new Map<string, number>())
  const sizeCache = externalSizeCache ?? internalSizes.current
  const prevSnapshotRef = useRef(snapshot)
  const prevSessionKeyRef = useRef(sessionKey)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const isPinnedRef = useRef(isPinned)
  isPinnedRef.current = isPinned

  const anchorController = useMemo(() => createAnchorController(), [])
  const activeAnchorRef = useRef<AnchorTarget | null>(null)
  const restingAnchorRef = useRef<AnchorTarget | null>(null)
  const selfWritingScrollRef = useRef(false)
  const adjustedScrollTopRef = useRef<number | null>(null)
  const pendingRestoreRafRef = useRef<number | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const lastHeaderHeightRef = useRef<number | null>(null)

  const [savedSelection, setSavedSelection] = useState<{
    sessionKey: string | undefined
    selection: RetainedSelection
  } | null>(null)
  const retainedSelection =
    savedSelection?.sessionKey === sessionKey ? (savedSelection?.selection ?? null) : null
  const retainedSelectionRef = useRef<RetainedSelection | null>(null)
  retainedSelectionRef.current = retainedSelection

  // Temporary sync-copy mount range (EP-17 ②)
  const [syncCopyRange, setSyncCopyRange] = useState<[number, number] | null>(null)
  // Chunked async-copy mount range inside CopySerializationHost (EP-17 ④)
  const [asyncChunkRange, setAsyncChunkRange] = useState<[number, number] | null>(null)
  const copyHostRef = useRef<HTMLDivElement | null>(null)
  const activeCopyJobRef = useRef<CopyJobHandle | null>(null)

  if (prevSessionKeyRef.current !== sessionKey) {
    prevSessionKeyRef.current = sessionKey
    prevSnapshotRef.current = snapshot
    activeAnchorRef.current = null
    restingAnchorRef.current = null
    adjustedScrollTopRef.current = null
    anchorController.cancelAnchor()
  }

  // Capture anchor BEFORE commit when snapshot head/keys change while unpinned (EP-12 ① · D1)
  if (prevSnapshotRef.current !== snapshot) {
    const prev = prevSnapshotRef.current
    const headChanged =
      prev.count > 0 &&
      snapshot.count > 0 &&
      (prev.keyAt(0) !== snapshot.keyAt(0) || prev.keyRevision !== snapshot.keyRevision)
    if (headChanged && !isPinned?.() && !activeAnchorRef.current) {
      const el = scrollRef.current
      const captured = el ? captureAnchor(el) : null
      const nextAnchor = captured ?? restingAnchorRef.current
      if (nextAnchor) {
        activeAnchorRef.current = nextAnchor
        anchorController.setActiveAnchor(nextAnchor)
      }
    }
    prevSnapshotRef.current = snapshot
  }

  // A viewport may outlive the active session. Cancel before its new content becomes visible.
  useLayoutEffect(() => {
    return () => {
      activeCopyJobRef.current?.cancel()
      activeCopyJobRef.current = null
    }
  }, [sessionKey])

  // Stable getItemKey identity pinned to snapshot.keyRevision (EP-10 ① · D-073 · v1 · v2)
  const getItemKey = useMemo(
    () => (index: number) => snapshotRef.current.keyAt(index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot.keyRevision]
  )

  // Fixed estimateSize callback reading key-based cache (EP-10 ① · D-073)
  const estimateSize = useCallback(
    (index: number) => {
      const snap = snapshotRef.current
      if (index < 0 || index >= snap.count) return estimateSizePx
      return sizeCache.get(snap.keyAt(index)) ?? estimateSizePx
    },
    [estimateSizePx, sizeCache]
  )

  const rangeExtractor = useCallback(
    (range: {
      startIndex: number
      endIndex: number
      overscan: number
      count: number
    }): number[] => {
      const snap = snapshotRef.current
      const sel = retainedSelection
      const endpoints =
        sel !== null
          ? {
              anchorIndex: selectionBlockIndex(snap, sel.anchor),
              focusIndex: selectionBlockIndex(snap, sel.focus)
            }
          : null
      const anchorIdx =
        anchorKey != null
          ? snap.indexOf(anchorKey)
          : activeAnchorRef.current
            ? snap.indexOf(activeAnchorRef.current.blockKey)
            : -1
      const base = selectionMountSet(range, endpoints, anchorIdx >= 0 ? anchorIdx : undefined)
      if (!syncCopyRange) return base
      const merged = new Set(base)
      const lo = Math.max(0, Math.min(syncCopyRange[0], syncCopyRange[1]))
      const hi = Math.min(range.count - 1, Math.max(syncCopyRange[0], syncCopyRange[1]))
      for (let i = lo; i <= hi; i++) merged.add(i)
      return Array.from(merged).sort((a, b) => a - b)
    },
    [anchorKey, retainedSelection, syncCopyRange]
  )

  const flushAnchorRestore = useCallback((): void => {
    const el = scrollRef.current
    const anchor = activeAnchorRef.current
    if (!el || !anchor || isPinnedRef.current?.()) return
    const snap = snapshotRef.current
    const nextTop = restoreAnchor(el, anchor, () => {
      const blocks = el.querySelectorAll<HTMLElement>('[data-index]')
      return Array.from(blocks, (element) => {
        const block = snap.blockAt(Number(element.getAttribute('data-index')))
        return {
          blockKey: block.key,
          messageId: block.messageId,
          partKeys: block.partKeys ?? [block.key]
        }
      })
    })
    if (nextTop !== null && Math.abs(nextTop - el.scrollTop) > 0.5) {
      selfWritingScrollRef.current = true
      try {
        writeScrollTop(el, nextTop)
        adjustedScrollTopRef.current = el.scrollTop
      } finally {
        selfWritingScrollRef.current = false
      }
    }
  }, [scrollRef])

  const scheduleAnchorRestore = useCallback((): void => {
    if (isPinnedRef.current?.() || pendingRestoreRafRef.current !== null) return
    if (typeof requestAnimationFrame !== 'function') {
      flushAnchorRestore()
      return
    }
    pendingRestoreRafRef.current = requestAnimationFrame(() => {
      pendingRestoreRafRef.current = null
      flushAnchorRestore()
    })
  }, [flushAnchorRestore])

  const measureElement = useCallback(
    (element: Element, entry?: ResizeObserverEntry) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height
      const key = element.getAttribute('data-block-key')
      if (key && height > 0) {
        const prevHeight = sizeCache.get(key)
        sizeCache.set(key, height)
        if (
          prevHeight !== undefined &&
          Math.abs(prevHeight - height) > 0.5 &&
          !isPinnedRef.current?.()
        ) {
          const snap = snapshotRef.current
          const itemIdx = snap.indexOf(key)
          const existingAnchor = activeAnchorRef.current ?? restingAnchorRef.current
          const anchorIdx = existingAnchor ? snap.indexOf(existingAnchor.blockKey) : -1
          const isAbove =
            (anchorIdx >= 0 && itemIdx >= 0 && itemIdx < anchorIdx) ||
            (scrollRef.current !== null &&
              element.getBoundingClientRect().top < scrollRef.current.getBoundingClientRect().top)
          if (isAbove) {
            if (!activeAnchorRef.current) {
              const target =
                restingAnchorRef.current ??
                (scrollRef.current ? captureAnchor(scrollRef.current) : null)
              if (target) {
                activeAnchorRef.current = target
                anchorController.setActiveAnchor(target)
              }
            }
            if (activeAnchorRef.current) scheduleAnchorRestore()
          }
        }
      }
      return height
    },
    [anchorController, scheduleAnchorRestore, scrollRef, sizeCache]
  )

  const virtualizer = useVirtualizer({
    count: virtualized ? snapshot.count : 0,
    getScrollElement: () => scrollRef.current,
    getItemKey,
    estimateSize,
    overscan,
    initialOffset,
    rangeExtractor,
    measureElement
  })

  // EP-10 ③ (v3): Disable TanStack internal scroll adjustment — TranscriptViewport owns all scrollTop writes.
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false

  // Track user selection endpoints as (blockKey, partKey, charOffset) (EP-17 ⑥ · c14)
  useEffect(() => {
    if (!virtualized || typeof document === 'undefined') return
    const onSelectionChange = (): void => {
      const el = scrollRef.current
      if (!el) return
      const sel = document.getSelection()
      if (!sel || sel.isCollapsed) {
        setSavedSelection(null)
        return
      }
      if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return
      const anchor = findEndpoint(sel.anchorNode, sel.anchorOffset)
      const focus = findEndpoint(sel.focusNode, sel.focusOffset)
      if (anchor && focus) {
        setSavedSelection({ sessionKey, selection: { anchor, focus } })
      }
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [scrollRef, sessionKey, virtualized])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const retained = retainedSelectionRef.current
    const selection = el && retained && document.getSelection?.()
    if (!el || !retained || !selection) return
    if (selection.anchorNode && !el.contains(selection.anchorNode)) return
    restoreSelection(el, selection, retained)
  }, [scrollRef, snapshot])

  useLayoutEffect(() => {
    if (import.meta.env.VITE_OO_DIAGNOSTIC !== '1' || !sessionKey) return
    return attachDiagnosticViewport(sessionKey, scrollRef.current, snapshot, {
      findEndpoint,
      indexFor: (endpoint) => selectionBlockIndex(snapshot, endpoint),
      mountEndpoints: (selection) => flushSync(() => setSavedSelection({ sessionKey, selection }))
    })
  }, [sessionKey, snapshot, scrollRef])

  // Keyboard selection extension (EP-17 ⑤ · c6 · c11)
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!virtualized || !event.shiftKey || !SHIFT_EXTEND_KEYS.has(event.key)) return
      const sel = typeof document !== 'undefined' ? document.getSelection() : null
      if (!sel || sel.isCollapsed) return
      const anchor = findEndpoint(sel.anchorNode, sel.anchorOffset)
      const focus = findEndpoint(sel.focusNode, sel.focusOffset)
      if (anchor && focus) {
        setSavedSelection({ sessionKey, selection: { anchor, focus } })
      }
    },
    [sessionKey, virtualized]
  )

  // Copy handler (EP-17 ②~④ · c3~c5, c7~c9, c12~c19)
  const handleCopy = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!virtualized) return
      activeCopyJobRef.current?.cancel()
      const sel = retainedSelectionRef.current
      if (!sel) return
      const snap = snapshotRef.current
      const aIdx = selectionBlockIndex(snap, sel.anchor)
      const fIdx = selectionBlockIndex(snap, sel.focus)
      if (aIdx < 0 || fIdx < 0) return

      const lo = Math.min(aIdx, fIdx)
      const hi = Math.max(aIdx, fIdx)
      const spanCount = hi - lo + 1
      const cap = copyChunkSize ?? SELECTION_COPY_SYNC_MAX_BLOCKS
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()

      if (spanCount <= cap) {
        // Sync copy path (EP-17 ② · c3~c5)
        try {
          flushSync(() => setSyncCopyRange([lo, hi]))
          // Re-apply DOM selection across the newly mounted endpoints if needed
          const domSel = document.getSelection()
          const scroller = scrollRef.current
          if (domSel && scroller) restoreSelection(scroller, domSel, sel)
          onCopyTiming?.({
            kind: 'handler',
            durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
            blockCount: spanCount
          })
        } finally {
          requestAnimationFrame(() => setSyncCopyRange(null))
        }
        return
      }

      // Async chunked copy path (> cap) (EP-17 ③④ · c7 · c12~c19)
      event.preventDefault()
      onCopyTiming?.({
        kind: 'handler',
        durationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
        blockCount: 0
      })

      const forward = aIdx <= fIdx
      const startEndpoint = forward ? sel.anchor : sel.focus
      const endEndpoint = forward ? sel.focus : sel.anchor

      let diagnosticChunk = 0
      activeCopyJobRef.current = startCopyJob(
        lo,
        hi,
        {
          mountChunk: (cStart, cEnd) => {
            flushSync(() => setAsyncChunkRange([cStart, cEnd]))
          },
          serializeChunk: (_cStart, _cEnd, isFirst, isLast) => {
            if (import.meta.env.VITE_OO_DIAGNOSTIC === '1') checkCopyChunk(++diagnosticChunk)
            const host = copyHostRef.current
            const domSel = document.getSelection()
            if (!host || !domSel) return { text: '', html: '' }

            // Save user selection & focus
            const savedActive = document.activeElement as HTMLElement | null
            const savedAnchorNode = domSel.anchorNode
            const savedAnchorOffset = domSel.anchorOffset
            const savedFocusNode = domSel.focusNode
            const savedFocusOffset = domSel.focusOffset
            const hadSelection = domSel.rangeCount > 0

            try {
              const range = document.createRange()
              range.selectNodeContents(host)
              if (isFirst) {
                const startPart = host.querySelector(
                  `[data-part-key="${CSS.escape(startEndpoint.partKey)}"]`
                )
                if (startPart) {
                  const pt = pointAtPartOffset(startPart, startEndpoint.charOffset)
                  range.setStart(pt.node, pt.offset)
                }
              }
              if (isLast) {
                const endPart = host.querySelector(
                  `[data-part-key="${CSS.escape(endEndpoint.partKey)}"]`
                )
                if (endPart) {
                  const pt = pointAtPartOffset(endPart, endEndpoint.charOffset)
                  range.setEnd(pt.node, pt.offset)
                }
              }
              domSel.removeAllRanges()
              domSel.addRange(range)
              const text = domSel.toString()
              const wrapper = document.createElement('div')
              wrapper.appendChild(range.cloneContents())
              return { text, html: wrapper.innerHTML }
            } finally {
              // Restore user selection (including reverse direction) and focus (c19)
              domSel.removeAllRanges()
              if (hadSelection && savedAnchorNode && savedFocusNode) {
                try {
                  domSel.setBaseAndExtent(
                    savedAnchorNode,
                    savedAnchorOffset,
                    savedFocusNode,
                    savedFocusOffset
                  )
                } catch {
                  // Original nodes may have been unmounted
                }
              }
              if (
                savedActive &&
                typeof savedActive.focus === 'function' &&
                document.activeElement !== savedActive
              ) {
                savedActive.focus({ preventScroll: true })
              }
            }
          },
          unmountChunk: () => {
            flushSync(() => setAsyncChunkRange(null))
          },
          onTiming: onCopyTiming
        },
        { chunkSize: cap }
      )
    },
    [copyChunkSize, onCopyTiming, scrollRef, virtualized]
  )

  // Cancel pending anchor adjustments on user input and refresh resting anchor on user scroll (EP-12 ①⑦ · a8)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof el.addEventListener !== 'function') return
    const cancel = (): void => {
      adjustedScrollTopRef.current = null
      anchorController.cancelAnchor()
      activeAnchorRef.current = null
      if (pendingRestoreRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingRestoreRafRef.current)
        pendingRestoreRafRef.current = null
      }
    }
    const onKeyDownCancel = (event: Event): void => {
      const key = (event as KeyboardEvent).key
      if (SCROLL_CANCEL_KEYS.has(key)) cancel()
    }
    const onScroll = (): void => {
      if (selfWritingScrollRef.current) return
      const adjustedTop = adjustedScrollTopRef.current
      adjustedScrollTopRef.current = null
      if (adjustedTop !== null && Math.abs(el.scrollTop - adjustedTop) <= 0.5) return
      cancel()
      if (!isPinnedRef.current?.()) {
        restingAnchorRef.current = captureAnchor(el)
      }
    }
    el.addEventListener('wheel', cancel, { passive: true })
    el.addEventListener('pointerdown', cancel, { passive: true })
    el.addEventListener('keydown', onKeyDownCancel)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', cancel)
      el.removeEventListener('pointerdown', cancel)
      el.removeEventListener('keydown', onKeyDownCancel)
      el.removeEventListener('scroll', onScroll)
      if (pendingRestoreRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingRestoreRafRef.current)
        pendingRestoreRafRef.current = null
      }
    }
  }, [anchorController, scrollRef])

  // Observe header slot height changes for top-displacement anchor restoration (EP-12 ① · a9 · a10)
  useEffect(() => {
    const headerEl = headerRef.current
    if (!headerEl || typeof ResizeObserver === 'undefined') return
    lastHeaderHeightRef.current = headerEl.getBoundingClientRect().height
    const ro = new ResizeObserver((entries) => {
      const nextHeight =
        entries[0]?.borderBoxSize?.[0]?.blockSize ?? headerEl.getBoundingClientRect().height
      const prevHeight = lastHeaderHeightRef.current
      lastHeaderHeightRef.current = nextHeight
      if (
        prevHeight !== null &&
        Math.abs(prevHeight - nextHeight) > 0.5 &&
        !isPinnedRef.current?.()
      ) {
        if (!activeAnchorRef.current) {
          const target =
            restingAnchorRef.current ??
            (scrollRef.current ? captureAnchor(scrollRef.current) : null)
          if (target) {
            activeAnchorRef.current = target
            anchorController.setActiveAnchor(target)
          }
        }
        if (activeAnchorRef.current) scheduleAnchorRestore()
      }
    })
    ro.observe(headerEl)
    return () => ro.disconnect()
  }, [anchorController, header, scheduleAnchorRestore, scrollRef])

  // Restore anchor after top-displacement commits when active, and refresh resting baseline (EP-12 ①②③ · D1)
  useLayoutEffect(() => {
    const el = scrollRef.current
    const anchor = activeAnchorRef.current
    if (isPinned?.()) {
      activeAnchorRef.current = null
      restingAnchorRef.current = null
      anchorController.cancelAnchor()
    } else if (el && anchor) {
      scheduleAnchorRestore()
    } else if (el && snapshot.count > 0) {
      restingAnchorRef.current = captureAnchor(el)
    }
  }, [
    anchorController,
    isPinned,
    scheduleAnchorRestore,
    scrollRef,
    snapshot.count,
    snapshot.revision
  ])

  const reveal = useCallback(
    (root: HTMLElement): void => {
      const scroller = scrollRef.current
      if (!scroller) {
        revealElementInScrollParent(root)
        return
      }
      const viewportTop = scroller.getBoundingClientRect().top
      const top = root.getBoundingClientRect().top
      if (shouldScrollAfterCollapse(top, viewportTop)) {
        writeScrollTop(scroller, scroller.scrollTop + top - viewportTop)
      }
    },
    [scrollRef]
  )

  // Claude 0008 reserve gap (EP-11 ② · p3, p4, p12): computed from virtualizer measurements excluding reserve itself.
  const blocksTotalHeight = virtualized ? virtualizer.getTotalSize() : 0
  let reserveSpacerPx = 0
  if (enableReserveGap && virtualized && snapshot.count > 0) {
    let lastUserIndex = -1
    for (let i = snapshot.count - 1; i >= 0; i--) {
      if (snapshot.blockAt(i).reserveTarget) {
        lastUserIndex = i
        break
      }
    }
    if (lastUserIndex >= 0) {
      const viewportHeight = scrollRef.current?.clientHeight ?? 0
      const itemInfo = virtualizer.measurementsCache[lastUserIndex]
      const lastUserStart = itemInfo?.start
      reserveSpacerPx = reserveGap(viewportHeight, blocksTotalHeight, lastUserStart)
    }
  }

  const selectionRange = useMemo<[number, number] | null>(() => {
    if (!retainedSelection) return null
    const a = selectionBlockIndex(snapshot, retainedSelection.anchor)
    const f = selectionBlockIndex(snapshot, retainedSelection.focus)
    if (a < 0 || f < 0) return null
    return [Math.min(a, f), Math.max(a, f)]
  }, [retainedSelection, snapshot])

  const virtualItems: VirtualItem[] = virtualized ? virtualizer.getVirtualItems() : []
  const columnWidth = scrollRef.current?.clientWidth ?? 0

  return (
    <TranscriptRevealContext.Provider value={reveal}>
      <div
        data-transcript-viewport=""
        onCopy={virtualized ? handleCopy : undefined}
        onKeyDown={virtualized ? handleKeyDown : undefined}
        className="w-full"
      >
        {header && (
          <div ref={headerRef} data-transcript-header="">
            {header}
          </div>
        )}
        {virtualized ? (
          <div className="relative w-full" style={{ height: blocksTotalHeight }}>
            {virtualItems.map((vi) => {
              const block = snapshot.blockAt(vi.index)
              const selected =
                selectionRange !== null &&
                vi.index >= selectionRange[0] &&
                vi.index <= selectionRange[1]
              const extraClass = itemClassName?.(block, vi.index) ?? ''
              return (
                <div
                  key={block.key}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  data-block-key={block.key}
                  data-message-id={block.messageId}
                  data-part-key={
                    hasPartMarkers?.(block) ? undefined : (block.partKeys?.[0] ?? block.key)
                  }
                  className={`absolute top-0 left-0 w-full ${extraClass}`}
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  {renderBlock(block, vi.index, selected)}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex w-full flex-col">
            {Array.from({ length: snapshot.count }, (_, index) => {
              const block = snapshot.blockAt(index)
              const extraClass = itemClassName?.(block, index) ?? ''
              return (
                <div
                  key={block.key}
                  data-index={index}
                  data-block-key={block.key}
                  data-message-id={block.messageId}
                  data-part-key={
                    hasPartMarkers?.(block) ? undefined : (block.partKeys?.[0] ?? block.key)
                  }
                  className={`w-full ${extraClass}`}
                >
                  {renderBlock(block, index, false)}
                </div>
              )
            })}
          </div>
        )}
        {reserveSpacerPx > 0 && (
          <div data-reserve-spacer="" aria-hidden="true" style={{ height: reserveSpacerPx }} />
        )}
        {footer}
      </div>
      {asyncChunkRange && (
        <CopySerializationHost hostRef={copyHostRef} widthPx={columnWidth}>
          {Array.from({ length: asyncChunkRange[1] - asyncChunkRange[0] + 1 }, (_, offset) => {
            const index = asyncChunkRange[0] + offset
            if (index < 0 || index >= snapshot.count) return null
            const block = snapshot.blockAt(index)
            return (
              <div
                key={block.key}
                data-block-key={block.key}
                className={itemClassName?.(block, index)}
                data-part-key={
                  hasPartMarkers?.(block) ? undefined : (block.partKeys?.[0] ?? block.key)
                }
              >
                {renderBlock(block, index, false)}
              </div>
            )
          })}
        </CopySerializationHost>
      )}
    </TranscriptRevealContext.Provider>
  )
}
