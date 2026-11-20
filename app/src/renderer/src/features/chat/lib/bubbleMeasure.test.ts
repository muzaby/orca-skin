import { describe, expect, it } from 'vitest'
import {
  createBubbleMeasureCoordinator,
  type BubbleMeasureEnv,
  type FontSetLike,
  type ResizeObserverEntryLike,
  type ResizeObserverLike
} from './bubbleMeasure'

function createFakeBubbleElement(initialScrollHeight: number, onRead?: () => void): HTMLElement {
  let scrollHeight = initialScrollHeight
  const el = {
    get scrollHeight(): number {
      onRead?.()
      return scrollHeight
    },
    set scrollHeight(value: number) {
      scrollHeight = value
    },
    get clientWidth(): number {
      throw new Error('clientWidth must not be read')
    },
    get offsetHeight(): number {
      throw new Error('offsetHeight must not be read')
    },
    getBoundingClientRect(): DOMRect {
      throw new Error('getBoundingClientRect must not be read')
    }
  }
  return el as unknown as HTMLElement
}

interface MeasureTestHarness {
  coordinator: ReturnType<typeof createBubbleMeasureCoordinator>
  setLineHeight: (value: string) => void
  getRoCreated: () => number
  getRafCount: () => number
  getStyleReads: () => number
  resetCounters: () => void
  emitResize: (entries: Array<{ target: HTMLElement; inlineSize: number }>) => void
  emitEntries: (entries: ResizeObserverEntryLike[]) => void
  emitFontsLoadingDone: () => void
  flushFrame: () => void
}

function createTestHarness(lineHeight = '20px', fontSize = '14px'): MeasureTestHarness {
  let roCreated = 0
  let roCallback: ((entries: ReadonlyArray<ResizeObserverEntryLike>) => void) | null = null
  const observed = new Set<Element>()
  let rafCount = 0
  let nextRafId = 1
  const rafQueue = new Map<number, () => void>()
  let styleReads = 0
  const fontListeners = new Set<() => void>()

  const fonts: FontSetLike = {
    addEventListener(_type, listener) {
      fontListeners.add(listener)
    },
    removeEventListener(_type, listener) {
      fontListeners.delete(listener)
    }
  }

  const env: BubbleMeasureEnv = {
    createResizeObserver(cb): ResizeObserverLike {
      roCreated += 1
      roCallback = cb
      return {
        observe(target) {
          observed.add(target)
        },
        unobserve(target) {
          observed.delete(target)
        },
        disconnect() {
          observed.clear()
        }
      }
    },
    requestAnimationFrame(cb) {
      rafCount += 1
      const id = nextRafId++
      rafQueue.set(id, cb)
      return id
    },
    cancelAnimationFrame(id) {
      rafQueue.delete(id)
    },
    getComputedStyle() {
      styleReads += 1
      return { lineHeight, fontSize }
    },
    fonts
  }

  const coordinator = createBubbleMeasureCoordinator(env)

  return {
    coordinator,
    setLineHeight: (value) => {
      lineHeight = value
    },
    getRoCreated: () => roCreated,
    getRafCount: () => rafCount,
    getStyleReads: () => styleReads,
    resetCounters() {
      rafCount = 0
      styleReads = 0
    },
    emitResize(entries: Array<{ target: HTMLElement; inlineSize: number }>) {
      roCallback?.(
        entries.map((entry) => ({
          target: entry.target,
          contentBoxSize: [{ inlineSize: entry.inlineSize }]
        }))
      )
    },
    emitEntries(entries) {
      roCallback?.(entries)
    },
    emitFontsLoadingDone() {
      for (const listener of Array.from(fontListeners)) listener()
    },
    flushFrame() {
      const callbacks = Array.from(rafQueue.values())
      rafQueue.clear()
      for (const cb of callbacks) cb()
    }
  }
}

describe('bubbleMeasure (EP-18 m1~m8)', () => {
  it('m1·m2·m3: batches same-frame notifications into one rAF and executes all reads before writes', () => {
    const h = createTestHarness()
    const log: string[] = []
    let readCounts = [0, 0, 0]
    const b1 = createFakeBubbleElement(250, () => {
      readCounts[0] += 1
      log.push('R')
    })
    const b2 = createFakeBubbleElement(100, () => {
      readCounts[1] += 1
      log.push('R')
    })
    const b3 = createFakeBubbleElement(300, () => {
      readCounts[2] += 1
      log.push('R')
    })

    const results: boolean[] = []
    h.coordinator.observe(b1, { content: 'a', scale: 1, bubbleVariant: 'v1' }, (v) => {
      log.push('W')
      results[0] = v
    })
    h.coordinator.observe(b2, { content: 'b', scale: 1, bubbleVariant: 'v1' }, (v) => {
      log.push('W')
      results[1] = v
    })
    h.coordinator.observe(b3, { content: 'c', scale: 1, bubbleVariant: 'v1' }, (v) => {
      log.push('W')
      results[2] = v
    })

    // Single shared ResizeObserver and single queued rAF
    expect(h.getRoCreated()).toBe(1)
    expect(h.getRafCount()).toBe(1)

    h.emitResize([
      { target: b1, inlineSize: 400 },
      { target: b2, inlineSize: 400 },
      { target: b3, inlineSize: 400 }
    ])
    expect(h.getRafCount()).toBe(1)

    h.flushFrame()
    expect(readCounts).toEqual([1, 1, 1])
    expect(log).toEqual(['R', 'R', 'R', 'W', 'W', 'W'])
    expect(results).toEqual([true, false, true])

    // m2: notifications in a different frame schedule a new rAF
    readCounts = [0, 0, 0]
    h.emitResize([{ target: b1, inlineSize: 320 }])
    expect(h.getRafCount()).toBe(2)
    h.flushFrame()
    expect(readCounts).toEqual([1, 0, 0])
  })

  it('m4·m5: performs 0 DOM reads when all five invalidation inputs match, and re-reads when any changes', () => {
    const h = createTestHarness()
    let reads = 0
    const el = createFakeBubbleElement(120, () => {
      reads += 1
    })
    const content = { text: 'hello' }
    h.coordinator.observe(el, { content, scale: 1, bubbleVariant: 'v1' }, () => {})
    h.emitResize([{ target: el, inlineSize: 500 }])
    h.flushFrame()
    expect(reads).toBe(1)
    expect(h.getStyleReads()).toBe(1)

    // Same 5 inputs -> 0 DOM reads
    reads = 0
    h.resetCounters()
    h.emitResize([{ target: el, inlineSize: 500 }])
    h.coordinator.update(el, { content, scale: 1, bubbleVariant: 'v1' })
    h.flushFrame()
    expect(reads).toBe(0)
    expect(h.getStyleReads()).toBe(0)

    // Width changes -> re-read (lineHeight cached)
    h.emitResize([{ target: el, inlineSize: 480 }])
    h.flushFrame()
    expect(reads).toBe(1)
    expect(h.getStyleReads()).toBe(0)

    // Content reference changes -> re-read
    reads = 0
    const replacement = { text: 'hello' }
    h.coordinator.update(el, { content: replacement, scale: 1, bubbleVariant: 'v1' })
    h.flushFrame()
    expect(reads).toBe(1)

    // Scale changes -> re-read + new style read
    reads = 0
    h.resetCounters()
    h.coordinator.update(el, { content: replacement, scale: 1.25, bubbleVariant: 'v1' })
    h.flushFrame()
    expect(reads).toBe(1)
    expect(h.getStyleReads()).toBe(1)
  })

  it('m4·m5: tracks the inline width across array, object and legacy ResizeObserver entries', () => {
    const h = createTestHarness()
    let reads = 0
    const target = createFakeBubbleElement(220, () => {
      reads++
    })
    h.coordinator.observe(target, { content: 'same', scale: 1, bubbleVariant: 'same' }, () => {})
    const measure = (size: ResizeObserverEntryLike['contentBoxSize'], fallback: number): number => {
      h.emitEntries([{ target, contentBoxSize: size, contentRect: { width: fallback } }])
      h.flushFrame()
      return reads
    }
    expect(measure([{ inlineSize: 80, blockSize: 140 }], 200)).toBe(1)
    expect(measure({ inlineSize: 80, blockSize: 170 }, 210)).toBe(1)
    expect(measure({ inlineSize: 81, blockSize: 170 }, 210)).toBe(2)
    expect(measure([{ inlineSize: 82, blockSize: 170 }], 210)).toBe(3)
    expect(measure([{ inlineSize: NaN }], 82)).toBe(3)
    expect(measure({ inlineSize: Infinity }, 83)).toBe(4)
    expect(measure(undefined, 83)).toBe(4)
    expect(measure([], 84)).toBe(5)
  })

  it('m1·m3·m7: re-observing a mounted bubble updates its callback and detaching stops font events', () => {
    const h = createTestHarness()
    const target = createFakeBubbleElement(250)
    const labels: string[] = []
    const inputs = { content: 'first', scale: 1, bubbleVariant: 'same' }
    h.coordinator.observe(target, inputs, () => labels.push('first'))
    h.coordinator.observe(target, { ...inputs, content: 'replacement' }, () =>
      labels.push('replacement')
    )
    h.flushFrame()
    expect(labels).toEqual(['replacement'])
    h.coordinator.unobserve(target)
    const version = h.coordinator.getFontVersion()
    h.emitFontsLoadingDone()
    expect(h.coordinator.getFontVersion()).toBe(version)
  })

  it('m6·m7: shares lineHeight per (scale, fontVersion, bubbleVariant) and invalidates on document.fonts loadingdone', () => {
    const h = createTestHarness()
    let reads1 = 0
    let reads2 = 0
    const b1 = createFakeBubbleElement(120, () => {
      reads1 += 1
    })
    const b2 = createFakeBubbleElement(120, () => {
      reads2 += 1
    })

    h.coordinator.observe(b1, { content: 'a', scale: 1, bubbleVariant: 'v1' }, () => {})
    h.coordinator.observe(b2, { content: 'b', scale: 1, bubbleVariant: 'v1' }, () => {})
    h.flushFrame()
    expect(h.getStyleReads()).toBe(1)

    // loadingdone increments fontVersion and re-reads each observed bubble once
    reads1 = 0
    reads2 = 0
    h.resetCounters()
    h.emitFontsLoadingDone()
    expect(h.coordinator.getFontVersion()).toBe(1)
    h.flushFrame()
    expect(reads1).toBe(1)
    expect(reads2).toBe(1)
    expect(h.getStyleReads()).toBe(1)

    // Different bubbleVariant gets its own lineHeight cache slot
    h.resetCounters()
    const b3 = createFakeBubbleElement(120)
    h.coordinator.observe(b3, { content: 'c', scale: 1, bubbleVariant: 'v2' }, () => {})
    h.flushFrame()
    expect(h.getStyleReads()).toBe(1)
  })

  it('m7 remeasures after the last bubble unmounts and a font loads while the timeline is empty', () => {
    const h = createTestHarness()
    const visible: boolean[] = []
    const inputs = { content: 'same', scale: 1, bubbleVariant: 'v1' }
    const el = createFakeBubbleElement(250)
    h.coordinator.observe(el, inputs, (value) => visible.push(value))
    h.flushFrame()
    h.coordinator.unobserve(el)
    h.setLineHeight('30px')
    h.emitFontsLoadingDone()
    h.coordinator.observe(el, inputs, (value) => visible.push(value))
    h.flushFrame()
    expect(visible).toEqual([true, false])
  })

  it('m8: changing only bubbleVariant re-reads only that bubble', () => {
    const h = createTestHarness()
    let reads1 = 0
    let reads2 = 0
    const b1 = createFakeBubbleElement(120, () => {
      reads1 += 1
    })
    const b2 = createFakeBubbleElement(120, () => {
      reads2 += 1
    })
    h.coordinator.observe(b1, { content: 'same', scale: 1, bubbleVariant: 'A' }, () => {})
    h.coordinator.observe(b2, { content: 'same', scale: 1, bubbleVariant: 'A' }, () => {})
    h.emitResize([
      { target: b1, inlineSize: 400 },
      { target: b2, inlineSize: 400 }
    ])
    h.flushFrame()

    reads1 = 0
    reads2 = 0
    h.coordinator.update(b1, { content: 'same', scale: 1, bubbleVariant: 'B' })
    h.coordinator.update(b2, { content: 'same', scale: 1, bubbleVariant: 'A' })
    h.flushFrame()
    expect(reads1).toBe(1)
    expect(reads2).toBe(0)
  })
})
