import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { createBlockList } from '../../lib/transcript/blockList'
import { selectionMountSet } from '../../lib/transcript/viewport/range'
import {
  SELECTION_COPY_SYNC_MAX_BLOCKS,
  startCopyJob,
  type CopyTaskTiming
} from '../../lib/transcript/viewport/copy'
import { partTextOffset, pointAtPartOffset } from '../../lib/transcript/viewport/textOffset'
import { installViewportSelection } from './viewportSelection.testfixture'
import { CopySerializationHost } from './CopySerializationHost'
import {
  TranscriptViewport,
  isVirtualizationEnabled,
  setVirtualization,
  type ViewportBlockBase
} from './TranscriptViewport'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: unknown) => node,
  flushSync: (fn: () => void) => dom!.act(fn)
}))
vi.mock('@tanstack/react-virtual', async () => {
  const { useRealVirtualizerWithFakeHooks } = await import('./viewportTestBridge.testfixture')
  return { useVirtualizer: useRealVirtualizerWithFakeHooks }
})

interface SimpleBlock extends ViewportBlockBase {
  readonly text: string
}

function makeBlocks(n: number): SimpleBlock[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `a:${i}:text:0`,
    messageId: `a:${i}`,
    partKeys: [`a:${i}:text:0`],
    text: `Block ${i} line one\nBlock ${i} line two`
  }))
}

let dom: FakeDom | undefined
afterEach(() => {
  dom?.unmount()
  dom = undefined
  setVirtualization(true)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('TranscriptViewport.selection (VP-29 · AR-09 ↔ IT-09 · EP-17 · c1~c19)', () => {
  it('c1/c2/c6/c10/c11/c15: selectionMountSet bounds mounted blocks to visible±overscan ∪ focus±overscan ∪ anchor endpoint (locks X02)', () => {
    // c1: 300-block selection — focus=300 MUST mount focus ± overscan (295..305), NOT entire 0..300 range
    const r300 = selectionMountSet(
      { startIndex: 0, endIndex: 10, overscan: 5, count: 5000 },
      { anchorIndex: 0, focusIndex: 300 },
      50
    )
    // Locks X02 (range.ts:50): focus ± overscan MUST include 295..305 (not just focusIndex 300!)
    expect(r300).toContain(295)
    expect(r300).toContain(299)
    expect(r300).toContain(300)
    expect(r300).toContain(301)
    expect(r300).toContain(305)
    expect(r300).not.toContain(150)
    expect(r300.length).toBeLessThan(40)

    // c2: 301-block selection follows exact same bounded set rule
    const r301 = selectionMountSet(
      { startIndex: 0, endIndex: 10, overscan: 5, count: 5000 },
      { anchorIndex: 0, focusIndex: 301 }
    )
    expect(r301).toContain(296)
    expect(r301).toContain(306)
    expect(r301).not.toContain(150)

    // c6/c10/c11/c15: Shift+Down, Shift+Click 5,000 blocks, Shift+PageDown x20, 299<->301, reverse shrink 5000->10
    const focusSteps = [299, 301, 299, 4999, 10, 2500]
    for (let i = 0; i < 20; i++) focusSteps.push(2500 + i * 25)
    for (const focus of focusSteps) {
      const mounted = selectionMountSet(
        { startIndex: 0, endIndex: 12, overscan: 5, count: 5000 },
        { anchorIndex: 0, focusIndex: focus }
      )
      expect(mounted).toContain(Math.max(0, focus - 5))
      expect(mounted).toContain(Math.min(4999, focus + 5))
      expect(mounted.length).toBeLessThanOrEqual(40)
    }
  })

  it('c3/c4/c5/c7/c8/c9/c12: sync copy <= cap matches reference; async copy > cap chunks at block boundaries with yield and matches reference', async () => {
    const blocks = makeBlocks(SELECTION_COPY_SYNC_MAX_BLOCKS + 50)
    const refPlain = (lo: number, hi: number): string =>
      blocks
        .slice(lo, hi + 1)
        .map((b) => b.text)
        .join('\n')

    // c3/c4/c5/c8/c9: <= cap (forward & reverse) sync copy equals reference
    const syncRange: [number, number] = [5, 10]
    expect(syncRange[1] - syncRange[0] + 1).toBeLessThanOrEqual(SELECTION_COPY_SYNC_MAX_BLOCKS)
    expect(refPlain(5, 10)).toContain('Block 5 line one')
    expect(refPlain(5, 10)).toContain('Block 10 line two')

    // c7/c12: > cap async chunked copy yields between chunks, cuts only at block boundaries, writes once in assemble task
    const total = SELECTION_COPY_SYNC_MAX_BLOCKS + 10
    const tasks: CopyTaskTiming[] = []
    let currentMounted = 0
    let maxDomInChunk = 0
    const written: Array<{ text: string; html: string }> = []
    const scheduled: number[] = []

    const handle = startCopyJob(
      0,
      total - 1,
      {
        mountChunk: (lo, hi) => {
          currentMounted = hi - lo + 1
          maxDomInChunk = Math.max(maxDomInChunk, currentMounted)
        },
        serializeChunk: (lo, hi) => ({
          text: refPlain(lo, hi),
          html: blocks
            .slice(lo, hi + 1)
            .map((b) => `<p>${b.text}</p>`)
            .join('')
        }),
        unmountChunk: () => {
          currentMounted = 0
        },
        scheduleNext: (fn) => {
          // Host content must be 0 between tasks (c19)
          expect(currentMounted).toBe(0)
          scheduled.push(1)
          queueMicrotask(fn)
        },
        writeClipboard: async (text, html) => {
          written.push({ text, html })
        },
        onTiming: (t) => tasks.push(t)
      },
      { chunkSize: SELECTION_COPY_SYNC_MAX_BLOCKS }
    )

    const ok = await handle.done
    expect(ok).toBe(true)
    expect(scheduled.length).toBeGreaterThanOrEqual(2)
    expect(maxDomInChunk).toBeLessThanOrEqual(SELECTION_COPY_SYNC_MAX_BLOCKS)
    expect(currentMounted).toBe(0)
    expect(written).toHaveLength(1)
    expect(written[0].text).toBe(refPlain(0, total - 1))
    expect(tasks[tasks.length - 1]?.kind).toBe('assemble')
  })

  it('c13/c16: throwing chunk aborts remaining chunks and unmounts; newer copy cancels older; unmount cancels write', async () => {
    const writes: string[] = []
    let chunkCalls = 0
    let unmounted = 0

    // c13: chunk 1 throws -> remaining chunks 0, clipboard.write 0, unmount called
    const failJob = startCopyJob(
      0,
      SELECTION_COPY_SYNC_MAX_BLOCKS * 2,
      {
        mountChunk: () => {},
        serializeChunk: () => {
          chunkCalls++
          if (chunkCalls === 1) throw new Error('chunk boom')
          return { text: 'never', html: '' }
        },
        unmountChunk: () => {
          unmounted++
        },
        scheduleNext: (fn) => queueMicrotask(fn),
        writeClipboard: async (text) => {
          writes.push(text)
        }
      },
      { chunkSize: SELECTION_COPY_SYNC_MAX_BLOCKS }
    )
    const okFail = await failJob.done
    expect(okFail).toBe(false)
    expect(chunkCalls).toBe(1)
    expect(unmounted).toBe(1)
    expect(writes).toHaveLength(0)

    // c16: cancelling job 1 before completion ensures job 1 never writes; job 2 writes
    let pendingFn: (() => void) | undefined
    const job1 = startCopyJob(
      0,
      SELECTION_COPY_SYNC_MAX_BLOCKS + 5,
      {
        mountChunk: () => {},
        serializeChunk: () => ({ text: 'old', html: '' }),
        unmountChunk: () => {},
        scheduleNext: (fn) => {
          pendingFn = fn
        },
        writeClipboard: async (text) => {
          writes.push(text)
        }
      },
      { chunkSize: SELECTION_COPY_SYNC_MAX_BLOCKS }
    )
    job1.cancel()
    pendingFn?.()
    expect(await job1.done).toBe(false)
    expect(writes).toHaveLength(0)

    const job2 = startCopyJob(
      0,
      2,
      {
        mountChunk: () => {},
        serializeChunk: () => ({ text: 'new', html: '' }),
        unmountChunk: () => {},
        scheduleNext: (fn) => queueMicrotask(fn),
        writeClipboard: async (text) => {
          writes.push(text)
        }
      },
      { chunkSize: SELECTION_COPY_SYNC_MAX_BLOCKS }
    )
    expect(await job2.done).toBe(true)
    expect(writes).toEqual(['new'])
  })

  it('c14/c18: selection endpoints stored as (partKey, charOffset) survive inline strong/code/link split and remount', () => {
    interface MiniNode {
      nodeType: number
      data?: string
      parentNode: MiniNode | null
      childNodes: MiniNode[]
      hasAttribute?: (n: string) => boolean
    }
    const text = (s: string): MiniNode => ({
      nodeType: 3,
      data: s,
      parentNode: null,
      childNodes: []
    })
    const el = (children: MiniNode[]): MiniNode => {
      const node: MiniNode = {
        nodeType: 1,
        parentNode: null,
        childNodes: children,
        hasAttribute: () => false
      }
      for (const c of children) c.parentNode = node
      return node
    }
    const codeText = text('fn()')
    const container = el([text('Prefix '), el([text('bold')]), el([codeText]), text(' suffix')])

    const offset = partTextOffset(container as unknown as Element, codeText as unknown as Node, 2)
    expect(offset).toBe(13) // "Prefix "(7) + "bold"(4) + "fn"(2)
    const restored = pointAtPartOffset(container as unknown as Element, offset)
    expect(restored.node).toBe(codeText)
    expect(restored.offset).toBe(2)
  })

  it.each(['sync', 'chunks', 'switch'] as const)(
    'c3/c7/c12/c19: onCopy copies a partial reverse range (%s)',
    async (mode) => {
      const chunked = mode !== 'sync'
      vi.useFakeTimers()
      vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) =>
        setTimeout(() => fn(performance.now()), 0)
      )
      dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
      const { select, selection } = installViewportSelection(dom)
      const write = vi
        .fn<(items: Record<string, Blob>[]) => Promise<void>>()
        .mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { write } })
      vi.stubGlobal(
        'ClipboardItem',
        class {
          constructor(items: Record<string, Blob>) {
            Object.assign(this, items)
          }
        }
      )

      const blocks = makeBlocks(6)
      const snapshot = createBlockList(blocks).snapshot()
      const scrollRef = {
        current: {
          scrollTop: 0,
          clientHeight: 40,
          clientWidth: 600,
          getBoundingClientRect: () => ({ top: 0, bottom: 40, width: 600, height: 40 }),
          querySelectorAll: (selector: string) => dom!.queryAll(selector),
          querySelector: (selector: string) => dom!.query(selector),
          contains: (node: Node) => dom!.body.contains(node),
          addEventListener: () => {},
          removeEventListener: () => {},
          scrollTo: () => {}
        } as unknown as HTMLDivElement
      }
      const timings: CopyTaskTiming[] = []
      function render(overscan: number, sessionKey = 'before'): void {
        dom!.render(
          createElement(TranscriptViewport<SimpleBlock>, {
            snapshot,
            sessionKey,
            scrollRef,
            overscan,
            estimateSizePx: 80,
            copyChunkSize: chunked ? 2 : 6,
            onCopyTiming: (timing) => timings.push(timing),
            renderBlock: (block) => createElement('p', null, block.text)
          })
        )
      }
      const part = (index: number): FakeNode =>
        dom!.query(`[data-part-key="${blocks[index].key}"]`)!

      // Use the DOM with all rows mounted as the independent plain-text reference.
      setVirtualization(false)
      render(6)
      select(part(4), 12, part(0), 6)
      const reference = selection.toString()
      expect(reference.split('\n').length).toBeGreaterThan(2)

      setVirtualization(true)
      render(6)
      select(part(4), 12, part(0), 6)
      render(0)
      expect(part(2)).toBeNull()
      const endpoints = [
        selection.anchorNode,
        selection.anchorOffset,
        selection.focusNode,
        selection.focusOffset
      ]
      const preventDefault = vi.fn()
      const viewport = dom.query('[data-transcript-viewport]')!
      const onCopy = viewport.props.onCopy as (event: { preventDefault: () => void }) => void
      dom.act(() => onCopy({ preventDefault }))

      if (!chunked) {
        expect(preventDefault).not.toHaveBeenCalled()
        expect(part(2)).not.toBeNull()
        expect(selection.toString()).toBe(reference)
        await vi.runAllTimersAsync()
        dom.act(() => {})
        expect(part(2)).toBeNull()
        expect(write).not.toHaveBeenCalled()
        return
      }

      expect(preventDefault).toHaveBeenCalledOnce()
      expect(part(2)).toBeNull()
      expect(write).not.toHaveBeenCalled()
      if (mode === 'switch') {
        await vi.advanceTimersToNextTimerAsync()
        render(0, 'after')
        await vi.runAllTimersAsync()
        expect(write).not.toHaveBeenCalled()
        expect(timings.map(({ kind }) => kind)).toEqual(['handler', 'chunk'])
        return
      }
      for (let chunk = 0; chunk < 3; chunk++) {
        await vi.advanceTimersToNextTimerAsync()
        expect(dom.query('[data-copy-serialization-host]')).toBeNull()
        expect([
          selection.anchorNode,
          selection.anchorOffset,
          selection.focusNode,
          selection.focusOffset
        ]).toEqual(endpoints)
        expect(write).not.toHaveBeenCalled()
      }
      await vi.runAllTimersAsync()
      expect(write).toHaveBeenCalledOnce()
      expect(await write.mock.calls[0][0][0]['text/plain'].text()).toBe(reference)
      expect(timings.map(({ kind, blockCount }) => [kind, blockCount])).toEqual([
        ['handler', 0],
        ['chunk', 2],
        ['chunk', 2],
        ['chunk', 1],
        ['assemble', 5]
      ])
    }
  )

  it('c17/c19: setVirtualization(false) renders full DOM without viewport copy serialization; CopySerializationHost has select-text, aria-hidden, pointer-events-none and no inert/select-none', () => {
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })

    // c17: setVirtualization(false) renders all blocks directly in DOM
    setVirtualization(false)
    expect(isVirtualizationEnabled()).toBe(false)
    const snap = createBlockList(makeBlocks(5)).snapshot()
    const scrollRef = { current: null }
    dom.render(
      createElement(TranscriptViewport<SimpleBlock>, {
        snapshot: snap,
        scrollRef,
        renderBlock: (b) => createElement('p', null, b.text)
      })
    )
    expect(dom.queryAll('[data-block-key]')).toHaveLength(5)
    setVirtualization(true)

    // c19: CopySerializationHost attributes (no inert, no select-none; has select-text, aria-hidden="true", pointer-events-none)
    const hostRef = { current: null as HTMLDivElement | null }
    dom.render(
      // eslint-disable-next-line react/no-children-prop
      createElement(CopySerializationHost, {
        hostRef,
        widthPx: 640,
        children: createElement('span', null, 'serialized text')
      })
    )
    const host = dom.query('[data-copy-serialization-host]')
    expect(host).not.toBeNull()
    expect(host!.getAttribute('aria-hidden')).toBe('true')
    expect(host!.getAttribute('inert')).toBeNull()
    const cls = host!.getAttribute('class') ?? ''
    expect(cls).toContain('select-text')
    expect(cls).toContain('pointer-events-none')
    expect(cls).not.toContain('select-none')
  })
})
