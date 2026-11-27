/**
 * Shared virtualized transcript viewport for Claude (code/work) and OpenCode (EP-10 · EP-11 · EP-12 · EP-17).
 *
 * - Single `useVirtualizer` instance across `features/chat` (EP-10 ①).
 * - `getItemKey` identity pinned to `snapshot.keyRevision` (D-073 · v1 · v2).
 * - `virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false` (EP-10 ③ · v3).
 * - Single `writeScrollTop` writer for all transcript scroll adjustments (EP-10 ②).
 * - Selection and copy are the browser default; a newly mounted row cancels a transcript
 *   selection and a cancelled drag stays unselected until release (EP-17 · ΔV2 D-102 · D-103).
 */
import {
  beginCorrection,
  cancelCorrection,
  noteCorrectionLayout,
  traceAnchorMeasurement,
  applyScrollWrite,
  isCorrecting,
  type ScrollOwner
} from '../../lib/transcript/viewport/scrollCorrection'
import {
  HistoryGesture,
  type HistoryDirection,
  type TranscriptHistoryControls
} from '../../lib/transcript/historyGesture'
import {
  nestedScrollConsumes,
  canConsumeScroll
} from '../../lib/transcript/viewport/scrollGeometry'
import { registerSearchOrigin, saveSearchPosition } from '../../lib/transcript/viewport/searchVisit'
import { revealSearchRow, type SearchReveal } from '../../lib/transcript/viewport/searchReveal'
import { useI18n } from '../../../../shared/i18n'
import { headInView, historyPull, HISTORY_PULL_HEIGHT_PX } from '../../lib/transcript/historyPull'
import {
  entryMoving,
  pauseEntryMotion,
  resumeEntryMotion,
  cancelEntryMotion
} from '../../lib/transcript/viewport/entryMotion'
import { ArcSpinner } from '../../../../shared/ui/ArcSpinner'
import { HistoryEdge } from './HistoryEdge'
import { VirtualRowMountContext } from '../../../../shared/ui/virtual/rowMount'
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
import { useVirtualizer, type VirtualItem, type Virtualizer } from '@tanstack/react-virtual'
import type { BlockSnapshot } from '../../lib/transcript/blockList'
import { shouldScrollAfterCollapse } from '../../lib/bubbleCollapse'
import { viewportMountSet } from '../../lib/transcript/viewport/range'
import {
  gestureReducer,
  isSuppressed,
  shouldCancelSelection,
  type GestureEvent,
  type GestureState,
  type SelectionPlace
} from '../../lib/transcript/viewport/selectionGuard'
import { reserveGap } from '../../lib/transcript/viewport/reserve'
import {
  captureAnchor,
  createAnchorController,
  restoreAnchor,
  type AnchorTarget
} from '../../lib/transcript/viewport/anchor'
import { attachDiagnosticViewport } from '../../dev/transcriptViewportDiagnostics'

// --- Diagnostic virtualization toggle (S5 · ΔV2: full mount, no selection guard) ---
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
export function writeScrollTop(
  element: HTMLElement,
  top: number,
  behavior?: ScrollBehavior,
  owner: ScrollOwner = 'viewport'
): void {
  applyScrollWrite(element, owner, () => {
    const mode = owner === 'anchor' || owner === 'virtualizer' ? 'instant' : behavior
    if (mode && typeof element.scrollTo === 'function') element.scrollTo({ top, behavior: mode })
    else element.scrollTop = top
  })
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
  /** Revisions are local to the model that produced the snapshot. */
  readonly blockModel?: object
  readonly sessionKey?: string
  readonly scrollRef: RefObject<HTMLDivElement | null>
  readonly hasPartMarkers?: (block: Block) => boolean
  readonly renderBlock: (block: Block, index: number, selected: boolean) => ReactNode
  readonly overscan?: number
  readonly estimateSizePx?: number
  readonly startAtEnd?: boolean
  readonly initialOffset?: number
  readonly sizeCache?: Map<string, number>
  /** When true, computes Claude 0008 reserveGap from the last block with `reserveTarget: true`. */
  readonly enableReserveGap?: boolean
  /** Controls exist only for a view opened with partial history. */
  readonly search?: SearchReveal
  readonly history?: TranscriptHistoryControls
  /** Optional header slot rendered above virtualized blocks (EP-12 ① · a9 · a10). */
  readonly header?: ReactNode
  /** Non-virtualized tail slot (pending steer, pending indicator, error banner, etc. — EP-11 ⑥). */
  readonly footer?: ReactNode
  /** When true (pinned to bottom), upward anchor restoration is skipped (EP-12 ⑥ · a4). */
  readonly isPinned?: () => boolean
  /** Optional anchor block key to keep mounted in rangeExtractor. */
  readonly anchorKey?: string | null
  /** Optional className applied to each positioned block wrapper. */
  readonly itemClassName?: (block: Block, index: number) => string
}

function selectionBlockIndex(
  snapshot: BlockSnapshot<ViewportBlockBase>,
  endpoint: { readonly blockKey: string; readonly partKey: string }
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
  blockModel,
  sessionKey,
  scrollRef,
  renderBlock,
  hasPartMarkers,
  overscan = 6,
  estimateSizePx = 120,
  initialOffset,
  startAtEnd = false,
  sizeCache: externalSizeCache,
  enableReserveGap = false,
  header,
  history,
  search,
  footer,
  isPinned,
  anchorKey,
  itemClassName
}: TranscriptViewportProps<Block>): React.JSX.Element {
  const virtualized = useSyncExternalStore(
    subscribeVirtualization,
    isVirtualizationEnabled,
    isVirtualizationEnabled
  )

  const historyEnabled = history !== undefined
  const historyRef = useRef(history)
  historyRef.current = history
  const [pulling, setPulling] = useState<HistoryDirection | null>(null)
  const showPull = historyPull(pulling === 'before', history?.before, false, 0)
  const internalSizes = useRef(new Map<string, number>())
  const sizeCache = externalSizeCache ?? internalSizes.current
  const prevSnapshotRef = useRef(snapshot)
  const prevSessionKeyRef = useRef(sessionKey)
  const prevSearchRef = useRef(search?.seq)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const isPinnedRef = useRef(isPinned)
  isPinnedRef.current = isPinned

  const anchorController = useMemo(() => createAnchorController(), [])
  const activeAnchorRef = useRef<AnchorTarget | null>(null)
  const restingAnchorRef = useRef<AnchorTarget | null>(null)
  const interruptedAnchorLayout = useRef(false)
  const pinnedPrepend = useRef(false)
  const selfWritingScrollRef = useRef(false)
  const adjustedScrollTopRef = useRef<number | null>(null)
  const pullSpace = useRef<HTMLDivElement | null>(null)
  const pullSettling = useRef(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const footerRef = useRef<HTMLDivElement | null>(null)
  const lastHeaderHeightRef = useRef<number | null>(null)

  const requestHead = useCallback(
    (userInput = false): boolean => {
      const el = scrollRef.current
      const controls = historyRef.current
      if (
        !el ||
        !el.clientHeight ||
        controls?.before !== 'ready' ||
        isCorrecting(el) ||
        interruptedAnchorLayout.current ||
        entryMoving(el)
      )
        return false
      const height =
        headerRef.current?.querySelector('[data-history-edge="before"]')?.getBoundingClientRect()
          .height ?? 0
      return (
        (userInput || !isPinnedRef.current?.() || el.scrollHeight - el.clientHeight <= height) &&
        headInView(el.scrollTop, el.scrollHeight, el.clientHeight, height) &&
        controls.request('before')
      )
    },
    [scrollRef]
  )

  // ΔV2 (D-103): rows rendered by the previous commit, the drag gesture and the
  // rendered rows the native selection spans (display only — never restored).
  const renderedKeysRef = useRef<readonly string[]>([])
  const committedKeysRef = useRef<ReadonlySet<string>>(new Set())
  const gestureRef = useRef<GestureState>('idle')
  // Last selectionchange saw an end inside this viewport. A commit can detach the
  // selected nodes before the browser reports the change, so the place is read from here.
  const selectionInsideRef = useRef(false)
  const [suppressed, setSuppressed] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<{
    sessionKey: string | undefined
    anchor: string
    focus: string
  } | null>(null)

  const viewChanged =
    prevSessionKeyRef.current !== sessionKey || prevSearchRef.current !== search?.seq
  if (viewChanged) {
    prevSearchRef.current = search?.seq
    pullSettling.current = false
    if (pullSpace.current) {
      pullSpace.current.style.minHeight = ''
      pullSpace.current.getAnimations?.().forEach((animation) => animation.cancel())
    }
    cancelEntryMotion(scrollRef.current)
    interruptedAnchorLayout.current = false
    pinnedPrepend.current = false
    cancelCorrection(scrollRef.current)
    prevSessionKeyRef.current = sessionKey
    prevSnapshotRef.current = snapshot
    activeAnchorRef.current = null
    restingAnchorRef.current = null
    adjustedScrollTopRef.current = null
    anchorController.cancelAnchor()
  }

  // Capture anchor BEFORE commit when snapshot head/keys change while unpinned (EP-12 ① · D1)
  const previousBefore = useRef(history?.before)
  const releasedPull =
    !viewChanged &&
    pulling === 'before' &&
    previousBefore.current === 'loading' &&
    (history?.before === 'ready' || history?.before === 'end')
  previousBefore.current = history?.before
  if (prevSnapshotRef.current !== snapshot || releasedPull) {
    interruptedAnchorLayout.current = false
    const prev = prevSnapshotRef.current
    const headChanged =
      prev.count > 0 &&
      snapshot.count > 0 &&
      (prev.keyAt(0) !== snapshot.keyAt(0) ||
        prev.keyRevision !== snapshot.keyRevision ||
        prev.blockAt(0).partKeys?.[0] !== snapshot.blockAt(0).partKeys?.[0])
    const transitioning = entryMoving(scrollRef.current)
    if (headChanged && !transitioning && isPinned?.() && snapshot.count >= prev.count) {
      const first = prev.keyAt(0)
      pinnedPrepend.current =
        first === snapshot.keyAt(0)
          ? prev.blockAt(0).partKeys?.[0] !== snapshot.blockAt(0).partKeys?.[0]
          : snapshot.indexOf(first) > 0
    }
    if (releasedPull || (headChanged && (!isPinned?.() || transitioning))) {
      const el = scrollRef.current
      const captured = activeAnchorRef.current ?? (el ? captureAnchor(el) : null)
      const nextAnchor = captured ?? restingAnchorRef.current
      if (nextAnchor) {
        activeAnchorRef.current = nextAnchor
        anchorController.setActiveAnchor(nextAnchor)
        if (el) {
          if (transitioning) pauseEntryMotion(el)
          pullSettling.current =
            releasedPull || Boolean(Number.parseFloat(pullSpace.current?.style.minHeight ?? ''))
          beginCorrection(el, () => {
            restingAnchorRef.current = activeAnchorRef.current
            activeAnchorRef.current = null
            anchorController.cancelAnchor()
            pullSettling.current = false
            resumeEntryMotion(el)
            if (requestHead()) return
            const space = pullSpace.current
            const residual = Number.parseFloat(space?.style.minHeight ?? '')
            if (space && residual > 0) {
              if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
                space.animate?.([{ minHeight: residual + 'px' }, { minHeight: '0px' }], {
                  duration: 200,
                  easing: 'ease-out'
                })
              space.style.removeProperty('min-height')
            }
          })
        }
      }
    }
    prevSnapshotRef.current = snapshot
  }

  // A viewport may outlive the active session. Drop the gesture of the previous one.
  useLayoutEffect(() => {
    return () => {
      gestureRef.current = 'idle'
      setSuppressed(false)
      setPulling(null)
    }
  }, [sessionKey, search?.seq])

  // Stable getItemKey identity pinned to snapshot.keyRevision (EP-10 ① · D-073 · v1 · v2)
  const getItemKey = useMemo(
    () => (index: number) => snapshotRef.current.keyAt(index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blockModel, snapshot.keyRevision]
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

  // A reset can move the reading part to another block outside the new visible window.
  // Resolve that uncommon case once per snapshot so the virtualizer mounts its row.
  const readingAnchor = activeAnchorRef.current
  const displacedAnchorIndex = useMemo(() => {
    if (!readingAnchor) return -1
    const previousRow = snapshot.indexOf(readingAnchor.blockKey)
    if (previousRow >= 0) {
      const block = snapshot.blockAt(previousRow)
      if (block.key === readingAnchor.partKey || block.partKeys?.includes(readingAnchor.partKey))
        return -1
    }
    const part = selectionBlockIndex(snapshot, readingAnchor)
    if (part >= 0) return part
    for (const key of readingAnchor.followingBlockKeys) {
      const index = snapshot.indexOf(key)
      if (index >= 0) return index
    }
    return Math.min(readingAnchor.blockIndex, snapshot.count - 1)
  }, [snapshot, readingAnchor])

  const target = search?.target
  const targetBlock = useMemo(() => {
    if (!target) return undefined
    for (let i = 0; i < snapshot.count; i++) {
      const b = snapshot.blockAt(i)
      if (
        b.messageId === target ||
        b.partKeys?.some((part) => part.startsWith(target + ':')) ||
        ('items' in b &&
          Array.isArray(b.items) &&
          b.items.some((item) => item.messageId === target)) ||
        ('turn' in b &&
          (b.turn as { messages?: { id: string }[] }).messages?.some((m) => m.id === target))
      )
        return { index: i, key: b.key }
    }
    return undefined
  }, [snapshot, target])
  const [announced, setAnnounced] = useState(0)
  const [releasedSequence, setReleasedSequence] = useState(0)
  const revealKey = targetBlock?.key
  const selectionSequence = search?.seq
  const keyboard = search?.keyboard ?? false
  const restoring = search?.restore ?? false
  useLayoutEffect(() => {
    if (!sessionKey) return
    return registerSearchOrigin(() => ({
      session: sessionKey,
      anchor: scrollRef.current ? captureAnchor(scrollRef.current) : null,
      pinned: !!isPinnedRef.current?.()
    }))
  }, [sessionKey, scrollRef])
  const storedAnchor = search?.anchor
  const visit = search?.visit,
    visitSession = search?.sessionId,
    visitGeneration = search?.generation
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || visit === undefined || !visitGeneration || !visitSession) return
    const record = (): void => {
      const anchor = captureAnchor(root)
      if (anchor) saveSearchPosition(visit, visitSession, visitGeneration, anchor)
    }
    root.addEventListener('scroll', record, { passive: true })
    return () => root.removeEventListener('scroll', record)
  }, [scrollRef, visit, visitSession, visitGeneration])
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || !target || selectionSequence === undefined || !revealKey) return
    cancelCorrection(root)
    return revealSearchRow(
      root,
      { seq: selectionSequence, target, keyboard, restore: restoring },
      () => {
        const block = root.querySelector<HTMLElement>(
          '[data-block-key="' + CSS.escape(revealKey) + '"]'
        )
        return (
          block?.querySelector<HTMLElement>(
            '[data-part-key="' + CSS.escape(target + ':user') + '"]'
          ) ??
          block ??
          undefined
        )
      },
      (top) => writeScrollTop(root, top),
      () => setAnnounced(selectionSequence),
      () => setReleasedSequence(selectionSequence),
      storedAnchor ? () => restoreAnchor(root, storedAnchor) : undefined
    )
  }, [scrollRef, target, selectionSequence, revealKey, keyboard, restoring, storedAnchor])
  const rangeExtractor = useCallback(
    (range: {
      startIndex: number
      endIndex: number
      overscan: number
      count: number
    }): number[] => {
      const snap = snapshotRef.current
      const anchorIdx =
        anchorKey != null
          ? snap.indexOf(anchorKey)
          : activeAnchorRef.current
            ? snap.indexOf(activeAnchorRef.current.blockKey)
            : -1
      return viewportMountSet(
        range,
        (selectionSequence !== releasedSequence ? targetBlock?.index : undefined) ??
          (anchorKey == null && displacedAnchorIndex >= 0 ? displacedAnchorIndex : anchorIdx)
      )
    },
    [anchorKey, displacedAnchorIndex, targetBlock, selectionSequence, releasedSequence]
  )

  const flushAnchorRestore = useCallback((): void => {
    const el = scrollRef.current
    const anchor = activeAnchorRef.current
    if (!el || !anchor || (isPinnedRef.current?.() && !isCorrecting(el))) return
    const snap = snapshotRef.current
    let nextTop = restoreAnchor(el, anchor, () => {
      const blocks = el.querySelectorAll<HTMLElement>('[data-block-key]')
      return Array.from(blocks, (element) => {
        const block = snap.blockAt(Number(element.getAttribute('data-index')))
        return {
          blockKey: block.key,
          messageId: block.messageId,
          partKeys: block.partKeys ?? [block.key]
        }
      })
    })
    if (nextTop !== null && pullSettling.current && pullSpace.current) {
      // Compute the residual against the *new* layout on every measurement.
      // An early virtual estimate may require a gap that the measured rows fill.
      const space = pullSpace.current
      const current = Number.parseFloat(space.style.minHeight) || 0
      const withoutGap = nextTop - current
      const required = Math.min(HISTORY_PULL_HEIGHT_PX, Math.max(0, -withoutGap))
      if (required !== current) space.style.minHeight = required + 'px'
      nextTop = withoutGap + required
    }
    if (nextTop !== null && Math.abs(nextTop - el.scrollTop) > 0.5) {
      selfWritingScrollRef.current = true
      try {
        writeScrollTop(el, nextTop, undefined, 'anchor')
        adjustedScrollTopRef.current = el.scrollTop
      } finally {
        selfWritingScrollRef.current = false
      }
    }
  }, [scrollRef])

  const settleFrame = useRef<number | null>(null)
  const settleInterruptedLayout = useCallback(() => {
    if (!interruptedAnchorLayout.current || typeof requestAnimationFrame !== 'function') return
    if (settleFrame.current !== null) cancelAnimationFrame(settleFrame.current)
    // Give pending ResizeObserver deliveries a frame to restart this wait. Once the
    // layout is quiet the current reading position is the baseline for later resizes.
    settleFrame.current = requestAnimationFrame(() => {
      settleFrame.current = requestAnimationFrame(() => {
        settleFrame.current = null
        if (!interruptedAnchorLayout.current) return
        interruptedAnchorLayout.current = false
        const el = scrollRef.current
        if (el && !isPinnedRef.current?.()) restingAnchorRef.current = captureAnchor(el)
        requestHead()
      })
    })
  }, [scrollRef, requestHead])

  // Child refs arrive together in a commit. Measure their actual boxes before
  // resizeItem writes any sibling transforms or the container's total height.
  const attachingRows = useRef(new Set<Element>())
  const attachedHeights = useRef(new Map<Element, number>())
  const awaitingFirstObservation = useRef(new WeakSet<Element>())
  const measureElement = useCallback(
    (
      element: Element,
      entry: ResizeObserverEntry | undefined,
      instance: Virtualizer<HTMLDivElement, Element>
    ) => {
      const key = element.getAttribute('data-block-key')
      const prevHeight = key ? sizeCache.get(key) : undefined
      const observedNode = key === null ? undefined : instance.elementsCache.get(key)
      if (entry) {
        awaitingFirstObservation.current.delete(element)
        const index = instance.indexFromElement(element)
        if (index < 0 || index >= instance.options.count) return 0
        const currentKey = instance.options.getItemKey(index)
        if (currentKey !== key || (observedNode && observedNode !== element)) {
          // A queued entry from a replaced or moved node cannot size its successor.
          return instance.itemSizeCache.get(currentKey) ?? instance.options.estimateSize(index)
        }
      } else if (awaitingFirstObservation.current.has(element) && observedNode === element) {
        return instance.options.estimateSize(instance.indexFromElement(element))
      }
      // Only a row registered with this virtualizer's observer will receive a fresh
      // border-box measurement after this ref callback.
      if (
        !entry &&
        !attachedHeights.current.has(element) &&
        key !== null &&
        prevHeight !== undefined &&
        instance.targetWindow?.ResizeObserver &&
        observedNode === element &&
        !activeAnchorRef.current &&
        !isCorrecting(scrollRef.current)
      )
        return prevHeight
      let rect: DOMRect | undefined
      let height = entry?.borderBoxSize?.[0]?.blockSize ?? attachedHeights.current.get(element)
      if (height === undefined) {
        rect = element.getBoundingClientRect()
        height = rect.height
      }
      if (key && height > 0) {
        sizeCache.set(key, height)
        const changed = prevHeight !== height
        const correcting = changed && noteCorrectionLayout(scrollRef.current)
        if (changed) settleInterruptedLayout()
        if (
          !interruptedAnchorLayout.current &&
          (prevHeight !== undefined || correcting) &&
          Math.abs((prevHeight ?? estimateSizePx) - height) > 0.5 &&
          (!isPinnedRef.current?.() || correcting)
        ) {
          const snap = snapshotRef.current
          const itemIdx = snap.indexOf(key)
          const existingAnchor = activeAnchorRef.current ?? restingAnchorRef.current
          const anchorIdx = existingAnchor ? snap.indexOf(existingAnchor.blockKey) : -1
          const isAbove =
            (anchorIdx >= 0 && itemIdx >= 0 && itemIdx < anchorIdx) ||
            (scrollRef.current !== null &&
              (rect ?? element.getBoundingClientRect()).top <
                scrollRef.current.getBoundingClientRect().top)
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
            if (activeAnchorRef.current) {
              traceAnchorMeasurement(scrollRef.current, prevHeight === undefined)
              flushAnchorRestore()
            }
          }
        }
      }
      return height
    },
    [
      anchorController,
      estimateSizePx,
      flushAnchorRestore,
      scrollRef,
      settleInterruptedLayout,
      sizeCache
    ]
  )

  // Register the collected refs before the virtualizer's own layout effects
  // position the rows. No paint, microtask or ResizeObserver can intervene.
  useLayoutEffect(() => {
    const rows = attachingRows.current
    if (!rows.size) return
    const measured = attachedHeights.current
    const range = virtualizer.range
    const reading = !isPinnedRef.current?.()
    try {
      for (const row of rows) {
        if (!row.isConnected) {
          rows.delete(row)
          continue
        }
        const index = virtualizer.indexFromElement(row)
        const key = row.getAttribute('data-block-key')
        if (!key || index < 0 || index >= snapshot.count || snapshot.keyAt(index) !== key) {
          rows.delete(row)
          continue
        }
        const previous = virtualizer.elementsCache.get(key)
        if ((previous !== undefined && previous !== row) || !sizeCache.has(key)) {
          if (
            reading &&
            range &&
            index > range.endIndex &&
            (!previous || (previous === row && awaitingFirstObservation.current.has(row))) &&
            !activeAnchorRef.current &&
            !isCorrecting(scrollRef.current) &&
            (selectionSequence === undefined || selectionSequence === releasedSequence) &&
            !anchorKey &&
            !entryMoving(scrollRef.current)
          ) {
            // New registration guarantees a first RO delivery for this offscreen row.
            awaitingFirstObservation.current.add(row)
          } else {
            awaitingFirstObservation.current.delete(row)
            measured.set(row, row.getBoundingClientRect().height)
          }
        }
      }
      for (const row of rows) {
        if (row.isConnected) virtualizer.measureElement(row)
      }
    } finally {
      measured.clear()
      rows.clear()
    }
  })
  const viewportInstance = useRef<Virtualizer<HTMLDivElement, Element> | null>(null)
  const virtualizer = useVirtualizer({
    count: virtualized ? snapshot.count : 0,
    directDomUpdates: true,
    onChange: () => {
      if (isCorrecting(scrollRef.current)) flushAnchorRestore()
    },
    // On the first commit the child layout effect runs before React attaches the
    // ancestor ref. The viewport node already belongs to the mounted scroller.
    getScrollElement: () =>
      scrollRef.current ??
      viewportRef.current?.closest<HTMLDivElement>('[data-behavior="virtualizable"]') ??
      null,
    getItemKey,
    estimateSize,
    overscan,
    // A new pinned scroller will be placed at the bottom by its harness.
    // Seed the first mounted range there instead of laying out both ends.
    initialOffset: startAtEnd
      ? () => {
          const initial = viewportInstance.current
          const total = initial?.getTotalSize() ?? snapshot.count * estimateSizePx
          const height = initial?.scrollRect?.height ?? scrollRef.current?.clientHeight ?? 0
          return Math.max(0, total - height)
        }
      : initialOffset,
    rangeExtractor,
    scrollToFn: (offset, { adjustments = 0, behavior }, instance) => {
      const el = instance.scrollElement
      if (el && el.scrollTop !== offset + adjustments)
        writeScrollTop(el, offset + adjustments, behavior, 'virtualizer')
    },
    measureElement
  })

  viewportInstance.current = virtualizer
  const attachRow = useCallback(
    (row: Element | null): void => {
      // Active restoration needs live top coordinates after each scroll write.
      if (
        !row ||
        !virtualizer.targetWindow?.ResizeObserver ||
        virtualizer.isScrolling ||
        activeAnchorRef.current ||
        isCorrecting(scrollRef.current)
      ) {
        if (row) awaitingFirstObservation.current.delete(row)
        virtualizer.measureElement(row)
      } else {
        attachingRows.current.add(row)
      }
    },
    [virtualizer, scrollRef]
  )

  // EP-10 ③ (v3): Disable TanStack internal scroll adjustment — TranscriptViewport owns all scrollTop writes.
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false

  // Where the native selection lives relative to this viewport (D-103).
  const selectionPlace = useCallback((): SelectionPlace => {
    if (gestureRef.current !== 'idle') return 'dragging'
    // Chromium collapses a selection whose nodes this commit removed before the layout effect
    // runs. The selection the user made still existed when the commit started.
    if (selectionInsideRef.current) return 'inside'
    const sel = typeof document !== 'undefined' ? document.getSelection?.() : null
    if (!sel || sel.isCollapsed || !sel.anchorNode || !sel.focusNode) return 'none'
    const root = viewportRef.current
    if (!root) return 'outside'
    return root.contains(sel.anchorNode) || root.contains(sel.focusNode) ? 'inside' : 'outside'
  }, [])

  const dispatchGesture = useCallback((event: GestureEvent): void => {
    const next = gestureReducer(gestureRef.current, event)
    if (next === gestureRef.current) return
    gestureRef.current = next
    setSuppressed(isSuppressed(next))
  }, [])

  const cancelNestedSelection = useCallback((): void => {
    const place = selectionPlace()
    if (place === 'none' || place === 'outside') return
    document.getSelection?.()?.removeAllRanges()
    selectionInsideRef.current = false
    setSelectedKeys(null)
    dispatchGesture({ type: 'cancel' })
  }, [selectionPlace, dispatchGesture])

  // Selection display — read the rows the native selection spans. A cancelled drag keeps
  // re-clearing any selection Chromium extends inside the viewport until release (D-103).
  useEffect(() => {
    if (!virtualized || typeof document === 'undefined') return
    const rowKey = (node: Node | null): string | null => {
      const el = node && (node.nodeType === 1 ? (node as Element) : node.parentElement)
      return el?.closest?.('[data-block-key]')?.getAttribute('data-block-key') ?? null
    }
    const onSelectionChange = (): void => {
      const root = viewportRef.current
      const sel = document.getSelection()
      if (!root || !sel || sel.isCollapsed || !sel.anchorNode || !sel.focusNode) {
        selectionInsideRef.current = false
        setSelectedKeys(null)
        return
      }
      const inside = root.contains(sel.anchorNode) || root.contains(sel.focusNode)
      selectionInsideRef.current = inside
      if (inside && isSuppressed(gestureRef.current)) {
        sel.removeAllRanges()
        selectionInsideRef.current = false
        setSelectedKeys(null)
        return
      }
      const anchor = rowKey(sel.anchorNode)
      const focus = rowKey(sel.focusNode)
      setSelectedKeys(anchor && focus ? { sessionKey, anchor, focus } : null)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [sessionKey, virtualized])

  // Gesture end — the pointer may be released outside the viewport.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onUp = (): void => dispatchGesture({ type: 'pointerup' })
    const onCancel = (): void => dispatchGesture({ type: 'pointercancel' })
    const onBlur = (): void => dispatchGesture({ type: 'blur' })
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onCancel, true)
    if (typeof window !== 'undefined') window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onCancel, true)
      if (typeof window !== 'undefined') window.removeEventListener('blur', onBlur)
    }
  }, [dispatchGesture])

  // Row mount → selection cancel (EP-17 ②③ · D-103). Runs after every commit on purpose:
  // the rendered key set is compared with the previous commit's. It settles because a cancel
  // leaves the key set unchanged for the next commit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const previousKeys = committedKeysRef.current
    const nextKeys = renderedKeysRef.current
    committedKeysRef.current = new Set(nextKeys)
    if (!virtualized) return
    if (!shouldCancelSelection({ previousKeys, nextKeys, selection: selectionPlace() })) return
    const start = typeof performance !== 'undefined' ? performance.now() : 0
    document.getSelection?.()?.removeAllRanges()
    selectionInsideRef.current = false
    setSelectedKeys(null)
    dispatchGesture({ type: 'cancel' })
    if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
      performance.measure('oo-selection-cancel', { start, end: performance.now() })
    }
  })

  useLayoutEffect(() => {
    if (import.meta.env.VITE_OO_DIAGNOSTIC !== '1' || !sessionKey) return
    return attachDiagnosticViewport(sessionKey, snapshot)
  }, [sessionKey, snapshot])

  // Cancel pending anchor adjustments on user input and refresh resting anchor on user scroll (EP-12 ①⑦ · a8)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof el.addEventListener !== 'function') return
    const cancel = (): void => {
      cancelCorrection(el)
      adjustedScrollTopRef.current = null
      if (activeAnchorRef.current) {
        // Later measurements of the same snapshot belong to the interrupted correction.
        interruptedAnchorLayout.current = true
        restingAnchorRef.current = null
        settleInterruptedLayout()
      }
      anchorController.cancelAnchor()
      activeAnchorRef.current = null
    }
    const gesture = new HistoryGesture()
    let afterFrame: number | undefined
    const request = (direction: HistoryDirection, target: EventTarget | null): boolean => {
      const controls = historyRef.current
      if (!controls || controls[direction] !== 'ready') return false
      const delta = direction === 'before' ? -1 : 1
      if (nestedScrollConsumes(target, el, delta)) return false
      if (direction === 'before') return requestHead(true)
      if (
        canConsumeScroll(
          { top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight },
          delta
        ) ||
        !controls.request(direction)
      )
        return false
      if (afterFrame !== undefined) cancelAnimationFrame(afterFrame)
      setPulling('after')
      afterFrame = requestAnimationFrame(() => {
        afterFrame = requestAnimationFrame(() => setPulling(null))
      })
      return true
    }
    const onWheel = (event: WheelEvent): void => {
      if (nestedScrollConsumes(event.target, el, event.deltaY)) return
      if (event.deltaY < 0) {
        cancelEntryMotion(el)
        if (historyPull(false, historyRef.current?.before, el.scrollTop <= 0, event.deltaY)) {
          gesture.consumePendingPull(event.timeStamp)
          setPulling('before')
          event.preventDefault()
          return
        }
      }
      const input = gesture.wheel(event.deltaY, event.timeStamp, (direction) =>
        request(direction, event.target)
      )
      if (input !== 'consumedPull') cancel()
      // After a prepend the same finger motion could now scroll into the new rows.
      // Keep propagation for the harness's independent unpin listener.
      if (input !== 'userInput') event.preventDefault()
    }
    const interrupt = (): void => {
      cancelEntryMotion(el)
      gesture.interrupt()
      cancel()
    }
    const onKeyDownCancel = (event: Event): void => {
      const key = (event as KeyboardEvent).key
      if (!SCROLL_CANCEL_KEYS.has(key)) return
      interrupt()
      if ((event as KeyboardEvent).repeat) return
      const direction =
        key === 'PageUp' || key === 'Home'
          ? 'before'
          : key === 'PageDown' || key === 'End'
            ? 'after'
            : undefined
      if (direction && request(direction, event.target)) event.preventDefault()
    }
    const onScroll = (): void => {
      if (selfWritingScrollRef.current) return
      if (entryMoving(el)) {
        // Chromium can deliver the final compositor scroll of an interrupted smooth
        // movement before this frame. A paused entry already belongs to the glyph anchor.
        if (isCorrecting(el)) flushAnchorRestore()
        return
      }
      // Chromium can deliver multiple scroll notifications for the same rounded position.
      // A changed position or an explicit input clears the correction in cancel().
      const adjustedTop = adjustedScrollTopRef.current
      if (adjustedTop !== null && Math.abs(el.scrollTop - adjustedTop) <= 0.5) return
      gesture.userScroll()
      cancel()
      if (!interruptedAnchorLayout.current && !isPinnedRef.current?.()) {
        restingAnchorRef.current = captureAnchor(el)
      }
      if (
        !requestHead() &&
        isPinnedRef.current?.() &&
        el.scrollTop <= (headerRef.current?.offsetHeight ?? 0)
      ) {
        // The harness updates pin state after the native scroll listener on a scrollbar drag.
        requestAnimationFrame(() => requestHead())
      }
    }
    const wheelListener = historyEnabled ? onWheel : interrupt
    el.addEventListener('wheel', wheelListener, { passive: !historyEnabled })
    el.addEventListener('touchstart', interrupt, { passive: true })
    el.addEventListener('pointerdown', interrupt, { passive: true })
    el.addEventListener('keydown', onKeyDownCancel)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (settleFrame.current !== null) {
        cancelAnimationFrame(settleFrame.current)
        settleFrame.current = null
      }
      cancelCorrection(el)
      if (afterFrame !== undefined) cancelAnimationFrame(afterFrame)
      el.removeEventListener('wheel', wheelListener)
      el.removeEventListener('touchstart', interrupt)
      el.removeEventListener('pointerdown', interrupt)
      el.removeEventListener('keydown', onKeyDownCancel)
      el.removeEventListener('scroll', onScroll)
    }
  }, [
    anchorController,
    historyEnabled,
    scrollRef,
    sessionKey,
    settleInterruptedLayout,
    requestHead,
    flushAnchorRestore
  ])

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
      if (prevHeight !== nextHeight) {
        noteCorrectionLayout(scrollRef.current)
        settleInterruptedLayout()
        requestHead()
      }
      if (
        !interruptedAnchorLayout.current &&
        !pulling &&
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
        if (activeAnchorRef.current) flushAnchorRestore()
      }
    })
    ro.observe(headerEl)
    return () => ro.disconnect()
  }, [
    anchorController,
    flushAnchorRestore,
    scrollRef,
    settleInterruptedLayout,
    pulling,
    requestHead
  ])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (noteCorrectionLayout(el)) flushAnchorRestore()
    })
    observer.observe(el)
    if (footerRef.current) observer.observe(footerRef.current)
    return () => observer.disconnect()
  }, [scrollRef, sessionKey, flushAnchorRestore])

  // Restore anchor after top-displacement commits when active, and refresh resting baseline (EP-12 ①②③ · D1)
  useLayoutEffect(() => {
    const el = scrollRef.current
    const anchor = activeAnchorRef.current
    if (isPinned?.() && !isCorrecting(el)) {
      cancelCorrection(el)
      if (el && pinnedPrepend.current) {
        const bottom = Math.max(0, el.scrollHeight - el.clientHeight)
        if (bottom - el.scrollTop > 0.5) writeScrollTop(el, bottom, 'instant')
      }
      activeAnchorRef.current = null
      restingAnchorRef.current = null
      anchorController.cancelAnchor()
    } else if (el && anchor) {
      flushAnchorRestore()
    } else if (el && snapshot.count > 0) {
      restingAnchorRef.current = captureAnchor(el)
    }
    pinnedPrepend.current = false
  }, [
    anchorController,
    isPinned,
    flushAnchorRestore,
    scrollRef,
    snapshot.count,
    snapshot.revision,
    releasedPull
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
    if (!selectedKeys || selectedKeys.sessionKey !== sessionKey) return null
    const a = snapshot.indexOf(selectedKeys.anchor)
    const f = snapshot.indexOf(selectedKeys.focus)
    if (a < 0 || f < 0) return null
    return [Math.min(a, f), Math.max(a, f)]
  }, [selectedKeys, sessionKey, snapshot])

  const virtualItems: VirtualItem[] = virtualized ? virtualizer.getVirtualItems() : []
  const renderedAnchorStart = readingAnchor
    ? virtualItems.find((item) => item.key === readingAnchor.blockKey)?.start
    : undefined
  // Nested blocks can commit after their containing row's position is unchanged.
  // Recheck the actual glyph once all layout effects for this commit have run.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && isCorrecting(el))
      queueMicrotask(() => {
        if (isCorrecting(el)) flushAnchorRestore()
      })
  })
  useLayoutEffect(() => {
    if (renderedAnchorStart !== undefined && noteCorrectionLayout(scrollRef.current))
      flushAnchorRestore()
  }, [renderedAnchorStart, scrollRef, flushAnchorRestore])
  useLayoutEffect(() => {
    if (pulling === 'before' && history?.before !== 'loading') setPulling(null)
    // Entry placement runs in the harness's parent layout effect. Check the
    // actual first painted location, not the ancestor's pre-placement offset.
    if (!history || typeof requestAnimationFrame !== 'function') return
    const frame = requestAnimationFrame(() => requestHead())
    return () => cancelAnimationFrame(frame)
  }, [history, snapshot.revision, requestHead, pulling])
  renderedKeysRef.current = virtualItems.map((vi) => snapshot.keyAt(vi.index))

  return (
    <VirtualRowMountContext.Provider value={cancelNestedSelection}>
      <TranscriptRevealContext.Provider value={reveal}>
        <div
          ref={viewportRef}
          data-transcript-viewport=""
          data-selection-suppressed={suppressed ? '' : undefined}
          onPointerDown={(event) => dispatchGesture({ type: 'pointerdown', button: event.button })}
          className={suppressed ? 'w-full select-none' : 'w-full'}
        >
          {search && <SearchAnnouncement key={search.seq} found={announced === search.seq} />}
          {history && (
            <div
              ref={pullSpace}
              data-history-pull=""
              className="flex items-center justify-center overflow-hidden motion-safe:duration-200 motion-safe:ease-out motion-reduce:duration-0"
              style={{
                height: showPull ? HISTORY_PULL_HEIGHT_PX : 0,
                transitionProperty: 'height, min-height',
                transitionDuration:
                  history.before !== 'error' && history.before !== 'loading' ? '0ms' : undefined
              }}
            >
              {showPull && <ArcSpinner />}
            </div>
          )}
          <div ref={headerRef} data-transcript-header="">
            {header}
            {history && (
              <HistoryEdge direction="before" history={history} pulling={pulling === 'before'} />
            )}
          </div>
          {virtualized ? (
            <div ref={virtualizer.containerRef} className="relative w-full">
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
                    ref={attachRow}
                    data-index={vi.index}
                    data-block-key={block.key}
                    data-message-id={block.messageId}
                    data-part-key={
                      hasPartMarkers?.(block) ? undefined : (block.partKeys?.[0] ?? block.key)
                    }
                    className={`absolute top-0 left-0 w-full ${extraClass}`}
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
          <div ref={footerRef}>
            {history?.after ? (
              <HistoryEdge direction="after" history={history} pulling={pulling === 'after'} />
            ) : (
              footer
            )}
          </div>
        </div>
      </TranscriptRevealContext.Provider>
    </VirtualRowMountContext.Provider>
  )
}

function SearchAnnouncement({ found }: { found: boolean }): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <span role="status" className="sr-only">
      {found ? tr('search.locationFound') : ''}
    </span>
  )
}
