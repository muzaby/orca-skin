import { useLayoutEffect, useState, type RefObject } from 'react'
import { bubbleOverflows, lineHeightPx } from './bubbleCollapse'

export interface BubbleMeasureInputs {
  /** 본문 prop 참조 (Object.is 비교) */
  content: unknown
  /** 글자 배율 설정값 */
  scale: number
  /** 버블 변형 (className · contentClassName · appFont 등) */
  bubbleVariant: string
}

interface MeasuredSnapshot {
  content: unknown
  width: number | undefined
  scale: number
  fontVersion: number
  bubbleVariant: string
}

interface ObservedBubble {
  element: HTMLElement
  inputs: BubbleMeasureInputs
  width: number | undefined
  lastMeasured: MeasuredSnapshot | null
  onOverflowChange: (overflowing: boolean) => void
}

export interface FontSetLike {
  addEventListener(type: 'loadingdone', listener: () => void): void
  removeEventListener(type: 'loadingdone', listener: () => void): void
}

export interface ResizeObserverEntryLike {
  target: Element
  contentBoxSize?:
    | ReadonlyArray<{ inlineSize: number; blockSize?: number }>
    | { inlineSize: number; blockSize?: number }
  contentRect?: { width: number }
}

export interface ResizeObserverLike {
  observe(target: Element): void
  unobserve(target: Element): void
  disconnect(): void
}

export interface BubbleMeasureEnv {
  createResizeObserver: (
    callback: (entries: ReadonlyArray<ResizeObserverEntryLike>) => void
  ) => ResizeObserverLike
  requestAnimationFrame: (callback: () => void) => number
  cancelAnimationFrame: (id: number) => void
  getComputedStyle: (element: Element) => { lineHeight: string; fontSize: string }
  fonts?: FontSetLike | null
}

function defaultEnv(): BubbleMeasureEnv {
  return {
    createResizeObserver: (cb) => new ResizeObserver(cb),
    requestAnimationFrame: (cb) => window.requestAnimationFrame(cb),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
    getComputedStyle: (el) => getComputedStyle(el),
    fonts: typeof document !== 'undefined' ? (document.fonts ?? null) : null
  }
}

function extractInlineWidth(entry: ResizeObserverEntryLike): number | undefined {
  const box = entry.contentBoxSize
  if (box) {
    if (Array.isArray(box)) {
      const first = box[0]
      if (first && Number.isFinite(first.inlineSize)) return first.inlineSize
    } else if ('inlineSize' in box && Number.isFinite(box.inlineSize)) {
      return box.inlineSize
    }
  }
  if (entry.contentRect && Number.isFinite(entry.contentRect.width)) {
    return entry.contentRect.width
  }
  return undefined
}

function inputsMatch(a: MeasuredSnapshot | null, b: MeasuredSnapshot): boolean {
  if (!a) return false
  return (
    Object.is(a.content, b.content) &&
    a.width === b.width &&
    a.scale === b.scale &&
    a.fontVersion === b.fontVersion &&
    a.bubbleVariant === b.bubbleVariant
  )
}

export interface BubbleMeasureCoordinator {
  observe(
    element: HTMLElement,
    inputs: BubbleMeasureInputs,
    onOverflowChange: (overflowing: boolean) => void
  ): void
  update(element: HTMLElement, inputs: BubbleMeasureInputs): void
  unobserve(element: HTMLElement): void
  lineHeightFor(
    element: HTMLElement,
    scale: number,
    fontVersion: number,
    bubbleVariant: string
  ): number
  getFontVersion(): number
  dispose(): void
}

export function createBubbleMeasureCoordinator(
  envOverride?: Partial<BubbleMeasureEnv>
): BubbleMeasureCoordinator {
  let resolvedEnv: BubbleMeasureEnv | null = null
  const getEnv = (): BubbleMeasureEnv => {
    if (!resolvedEnv) {
      resolvedEnv = { ...defaultEnv(), ...envOverride }
    }
    return resolvedEnv
  }

  let observer: ResizeObserverLike | null = null
  let fontsSubscribed = false
  let fontVersion = 0
  let rafId: number | null = null

  const entries = new Map<HTMLElement, ObservedBubble>()
  const pending = new Set<HTMLElement>()
  const lineHeightCache = new Map<string, number>()

  const onFontsLoadingDone = (): void => {
    fontVersion += 1
    if (entries.size === 0) return
    for (const el of entries.keys()) pending.add(el)
    scheduleFlush()
  }

  const ensureSubscribed = (): void => {
    const env = getEnv()
    if (!observer) {
      observer = env.createResizeObserver((roEntries) => {
        let dirty = false
        for (const entry of roEntries) {
          const record = entries.get(entry.target as HTMLElement)
          if (!record) continue
          const nextWidth = extractInlineWidth(entry)
          if (record.width !== nextWidth || record.lastMeasured === null) {
            record.width = nextWidth
            pending.add(record.element)
            dirty = true
          }
        }
        if (dirty) scheduleFlush()
      })
    }
    if (!fontsSubscribed && env.fonts) {
      env.fonts.addEventListener('loadingdone', onFontsLoadingDone)
      fontsSubscribed = true
    }
  }

  const lineHeightFor = (
    element: HTMLElement,
    scale: number,
    version: number,
    bubbleVariant: string
  ): number => {
    const cacheKey = `${scale}\0${version}\0${bubbleVariant}`
    const cached = lineHeightCache.get(cacheKey)
    if (cached !== undefined) return cached
    const style = getEnv().getComputedStyle(element)
    const computed = lineHeightPx(style.lineHeight, style.fontSize)
    lineHeightCache.set(cacheKey, computed)
    return computed
  }

  const flush = (): void => {
    rafId = null
    if (pending.size === 0) return
    const batch = Array.from(pending)
    pending.clear()

    // 1단계: 읽기 전용 (DOM 쓰기 없이 모든 버블 측정)
    const writes: Array<{ record: ObservedBubble; overflowing: boolean }> = []
    for (const element of batch) {
      const record = entries.get(element)
      if (!record) continue
      const snapshot: MeasuredSnapshot = {
        content: record.inputs.content,
        width: record.width,
        scale: record.inputs.scale,
        fontVersion,
        bubbleVariant: record.inputs.bubbleVariant
      }
      if (inputsMatch(record.lastMeasured, snapshot)) continue
      const lh = lineHeightFor(
        element,
        snapshot.scale,
        snapshot.fontVersion,
        snapshot.bubbleVariant
      )
      const overflowing = bubbleOverflows({
        scrollHeight: element.scrollHeight,
        lineHeightPx: lh
      })
      record.lastMeasured = snapshot
      writes.push({ record, overflowing })
    }

    // 2단계: 쓰기 전용 (상태 반영)
    for (const { record, overflowing } of writes) {
      record.onOverflowChange(overflowing)
    }
  }

  const scheduleFlush = (): void => {
    if (rafId !== null) return
    rafId = getEnv().requestAnimationFrame(flush)
  }

  const teardownIfEmpty = (): void => {
    if (entries.size > 0) return
    if (rafId !== null) {
      getEnv().cancelAnimationFrame(rafId)
      rafId = null
    }
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (fontsSubscribed && resolvedEnv?.fonts) {
      resolvedEnv.fonts.removeEventListener('loadingdone', onFontsLoadingDone)
      fontsSubscribed = false
    }
  }

  return {
    observe(element, inputs, onOverflowChange) {
      ensureSubscribed()
      const existing = entries.get(element)
      if (existing) {
        existing.inputs = inputs
        existing.onOverflowChange = onOverflowChange
      } else {
        entries.set(element, {
          element,
          inputs,
          width: undefined,
          lastMeasured: null,
          onOverflowChange
        })
        observer?.observe(element)
      }
      pending.add(element)
      scheduleFlush()
    },

    update(element, inputs) {
      const record = entries.get(element)
      if (!record) return
      record.inputs = inputs
      const snapshot: MeasuredSnapshot = {
        content: inputs.content,
        width: record.width,
        scale: inputs.scale,
        fontVersion,
        bubbleVariant: inputs.bubbleVariant
      }
      if (!inputsMatch(record.lastMeasured, snapshot)) {
        pending.add(element)
        scheduleFlush()
      }
    },

    unobserve(element) {
      if (!entries.delete(element)) return
      pending.delete(element)
      observer?.unobserve(element)
      teardownIfEmpty()
    },

    lineHeightFor,

    getFontVersion() {
      return fontVersion
    },

    dispose() {
      entries.clear()
      pending.clear()
      lineHeightCache.clear()
      teardownIfEmpty()
    }
  }
}

let sharedCoordinator: BubbleMeasureCoordinator | null = null

export function getSharedBubbleMeasureCoordinator(): BubbleMeasureCoordinator {
  if (!sharedCoordinator) {
    sharedCoordinator = createBubbleMeasureCoordinator()
  }
  return sharedCoordinator
}

export function resetSharedBubbleMeasureCoordinatorForTests(): void {
  sharedCoordinator?.dispose()
  sharedCoordinator = null
}

export function useBubbleOverflow(
  contentRef: RefObject<HTMLElement | null>,
  inputs: BubbleMeasureInputs,
  coordinator: BubbleMeasureCoordinator = getSharedBubbleMeasureCoordinator()
): boolean {
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return
    coordinator.observe(element, inputs, setOverflowing)
    return () => coordinator.unobserve(element)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 마운트·언마운트 수명만 관리하고 입력 갱신은 아래 effect 가 맡는다
  }, [contentRef, coordinator])

  useLayoutEffect(() => {
    const element = contentRef.current
    if (!element) return
    coordinator.update(element, inputs)
  }, [contentRef, coordinator, inputs.content, inputs.scale, inputs.bubbleVariant])

  return overflowing
}
