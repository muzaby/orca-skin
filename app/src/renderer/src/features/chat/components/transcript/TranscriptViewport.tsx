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
  HistoryGesture,
  type HistoryDirection,
  type TranscriptHistoryControls
} from '../../lib/transcript/historyGesture'
import {
  nestedScrollConsumes,
  canConsumeScroll
} from '../../lib/transcript/viewport/scrollGeometry'
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
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
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
  /** Revisions are local to the model that produced the snapshot. */
  readonly blockModel?: object
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
  /** Controls exist only for a view opened with partial history. */
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
  sizeCache: externalSizeCache,
  enableReserveGap = false,
  header,
  history,
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
  const interruptedAnchorLayout = useRef(false)
  const pinnedPrepend = useRef(false)
  const selfWritingScrollRef = useRef(false)
  const adjustedScrollTopRef = useRef<number | null>(null)
  const pendingRestoreRafRef = useRef<number | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const lastHeaderHeightRef = useRef<number | null>(null)

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

  if (prevSessionKeyRef.current !== sessionKey) {
    interruptedAnchorLayout.current = false
    pinnedPrepend.current = false
    prevSessionKeyRef.current = sessionKey
    prevSnapshotRef.current = snapshot
    activeAnchorRef.current = null
    restingAnchorRef.current = null
    adjustedScrollTopRef.current = null
    anchorController.cancelAnchor()
  }

  // Capture anchor BEFORE commit when snapshot head/keys change while unpinned (EP-12 ① · D1)
  if (prevSnapshotRef.current !== snapshot) {
    interruptedAnchorLayout.current = false
    const prev = prevSnapshotRef.current
    const headChanged =
      prev.count > 0 &&
      snapshot.count > 0 &&
      (prev.keyAt(0) !== snapshot.keyAt(0) ||
        prev.keyRevision !== snapshot.keyRevision ||
        prev.blockAt(0).partKeys?.[0] !== snapshot.blockAt(0).partKeys?.[0])
    if (headChanged && isPinned?.() && snapshot.count >= prev.count) {
      const first = prev.keyAt(0)
      pinnedPrepend.current =
        first === snapshot.keyAt(0)
          ? prev.blockAt(0).partKeys?.[0] !== snapshot.blockAt(0).partKeys?.[0]
          : snapshot.indexOf(first) > 0
    }
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

  // A viewport may outlive the active session. Drop the gesture of the previous one.
  useLayoutEffect(() => {
    return () => {
      gestureRef.current = 'idle'
      setSuppressed(false)
      setPulling(null)
    }
  }, [sessionKey])

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
        anchorKey == null && displacedAnchorIndex >= 0 ? displacedAnchorIndex : anchorIdx
      )
    },
    [anchorKey, displacedAnchorIndex]
  )

  const flushAnchorRestore = useCallback((): void => {
    const el = scrollRef.current
    const anchor = activeAnchorRef.current
    if (!el || !anchor || isPinnedRef.current?.()) return
    const snap = snapshotRef.current
    const nextTop = restoreAnchor(el, anchor, () => {
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
      })
    })
  }, [scrollRef])

  const measureElement = useCallback(
    (element: Element, entry?: ResizeObserverEntry) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? element.getBoundingClientRect().height
      const key = element.getAttribute('data-block-key')
      if (key && height > 0) {
        const prevHeight = sizeCache.get(key)
        sizeCache.set(key, height)
        if (prevHeight !== height) settleInterruptedLayout()
        if (
          !interruptedAnchorLayout.current &&
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
    [anchorController, scheduleAnchorRestore, scrollRef, settleInterruptedLayout, sizeCache]
  )

  const virtualizer = useVirtualizer({
    count: virtualized ? snapshot.count : 0,
    // On the first commit the child layout effect runs before React attaches the
    // ancestor ref. The viewport node already belongs to the mounted scroller.
    getScrollElement: () =>
      scrollRef.current ??
      viewportRef.current?.closest<HTMLDivElement>('[data-behavior="virtualizable"]') ??
      null,
    getItemKey,
    estimateSize,
    overscan,
    initialOffset,
    rangeExtractor,
    measureElement
  })

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
      adjustedScrollTopRef.current = null
      if (activeAnchorRef.current) {
        // Later measurements of the same snapshot belong to the interrupted correction.
        interruptedAnchorLayout.current = true
        restingAnchorRef.current = null
        settleInterruptedLayout()
      }
      anchorController.cancelAnchor()
      activeAnchorRef.current = null
      if (pendingRestoreRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingRestoreRafRef.current)
        pendingRestoreRafRef.current = null
      }
    }
    const gesture = new HistoryGesture()
    let pullFrame: number | undefined
    const request = (direction: HistoryDirection, target: EventTarget | null): boolean => {
      const controls = historyRef.current
      if (
        !controls ||
        !controls[direction] ||
        controls[direction] === 'end' ||
        controls[direction] === 'loading'
      )
        return false
      const delta = direction === 'before' ? -1 : 1
      if (
        canConsumeScroll(
          { top: el.scrollTop, height: el.scrollHeight, viewport: el.clientHeight },
          delta
        ) ||
        nestedScrollConsumes(target, el, delta)
      )
        return false
      if (!controls.request(direction)) return false
      if (pullFrame !== undefined) cancelAnimationFrame(pullFrame)
      setPulling(direction)
      pullFrame = requestAnimationFrame(() => {
        pullFrame = requestAnimationFrame(() => {
          pullFrame = undefined
          setPulling(null)
        })
      })
      return true
    }
    const onWheel = (event: WheelEvent): void => {
      const input = gesture.wheel(event.deltaY, event.timeStamp, (direction) =>
        request(direction, event.target)
      )
      if (input !== 'consumedPull') cancel()
      // After a prepend the same finger motion could now scroll into the new rows.
      // Keep propagation for the harness's independent unpin listener.
      if (input !== 'userInput') event.preventDefault()
    }
    const interrupt = (): void => {
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
      const adjustedTop = adjustedScrollTopRef.current
      adjustedScrollTopRef.current = null
      if (adjustedTop !== null && Math.abs(el.scrollTop - adjustedTop) <= 0.5) return
      gesture.userScroll()
      cancel()
      if (!interruptedAnchorLayout.current && !isPinnedRef.current?.()) {
        restingAnchorRef.current = captureAnchor(el)
      }
    }
    const wheelListener = historyEnabled ? onWheel : cancel
    el.addEventListener('wheel', wheelListener, { passive: !historyEnabled })
    el.addEventListener('pointerdown', interrupt, { passive: true })
    el.addEventListener('keydown', onKeyDownCancel)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (settleFrame.current !== null) {
        cancelAnimationFrame(settleFrame.current)
        settleFrame.current = null
      }
      if (pullFrame !== undefined) cancelAnimationFrame(pullFrame)
      el.removeEventListener('wheel', wheelListener)
      el.removeEventListener('pointerdown', interrupt)
      el.removeEventListener('keydown', onKeyDownCancel)
      el.removeEventListener('scroll', onScroll)
      if (pendingRestoreRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingRestoreRafRef.current)
        pendingRestoreRafRef.current = null
      }
    }
  }, [anchorController, historyEnabled, scrollRef, sessionKey, settleInterruptedLayout])

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
      if (prevHeight !== nextHeight) settleInterruptedLayout()
      if (
        !interruptedAnchorLayout.current &&
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
  }, [anchorController, scheduleAnchorRestore, scrollRef, settleInterruptedLayout])

  // Restore anchor after top-displacement commits when active, and refresh resting baseline (EP-12 ①②③ · D1)
  useLayoutEffect(() => {
    const el = scrollRef.current
    const anchor = activeAnchorRef.current
    if (isPinned?.()) {
      if (el && pinnedPrepend.current) {
        const bottom = Math.max(0, el.scrollHeight - el.clientHeight)
        if (bottom - el.scrollTop > 0.5) writeScrollTop(el, bottom)
      }
      activeAnchorRef.current = null
      restingAnchorRef.current = null
      anchorController.cancelAnchor()
    } else if (el && anchor) {
      scheduleAnchorRestore()
    } else if (el && snapshot.count > 0) {
      restingAnchorRef.current = captureAnchor(el)
    }
    pinnedPrepend.current = false
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
    if (!selectedKeys || selectedKeys.sessionKey !== sessionKey) return null
    const a = snapshot.indexOf(selectedKeys.anchor)
    const f = snapshot.indexOf(selectedKeys.focus)
    if (a < 0 || f < 0) return null
    return [Math.min(a, f), Math.max(a, f)]
  }, [selectedKeys, sessionKey, snapshot])

  const virtualItems: VirtualItem[] = virtualized ? virtualizer.getVirtualItems() : []
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
          <div ref={headerRef} data-transcript-header="">
            {header}
            {history && (
              <HistoryEdge direction="before" history={history} pulling={pulling === 'before'} />
            )}
          </div>
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
          {history?.after ? (
            <HistoryEdge direction="after" history={history} pulling={pulling === 'after'} />
          ) : (
            footer
          )}
        </div>
      </TranscriptRevealContext.Provider>
    </VirtualRowMountContext.Provider>
  )
}
