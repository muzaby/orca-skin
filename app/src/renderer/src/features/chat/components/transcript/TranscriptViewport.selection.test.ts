import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import * as errors from '../../../../shared/errors/reportError'
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

  it.each([2500, 5000])(
    'c1/c2/c6/c10/c11/c15: %i-block selections retain exactly the virtualized window and both ends on each frame',
    (count) => {
      dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
      const { select } = installViewportSelection(dom)
      const blocks = makeBlocks(count)
      const snapshot = createBlockList(blocks).snapshot()
      const scrollListeners = new Set<() => void>()
      const scroll = {
        scrollTop: 0,
        clientHeight: 40,
        clientWidth: 600,
        getBoundingClientRect: () => ({ top: 0, bottom: 40, width: 600, height: 40 }),
        querySelectorAll: (selector: string) => dom!.queryAll(selector),
        querySelector: (selector: string) => dom!.query(selector),
        contains: (node: Node) => dom!.body.contains(node),
        addEventListener: (type: string, listener: () => void) => {
          if (type === 'scroll') scrollListeners.add(listener)
        },
        removeEventListener: (type: string, listener: () => void) => {
          if (type === 'scroll') scrollListeners.delete(listener)
        },
        scrollTo: () => {}
      }
      const scrollRef = { current: scroll as unknown as HTMLDivElement }
      const render = (): void =>
        dom!.render(
          createElement(TranscriptViewport<SimpleBlock>, {
            snapshot,
            scrollRef,
            overscan: 2,
            estimateSizePx: 80,
            isPinned: () => true,
            renderBlock: (block) => createElement('p', null, block.text)
          })
        )
      function scrollTo(index: number): void {
        scroll.scrollTop = index * 80
        dom!.act(() => {
          for (const listener of scrollListeners) listener()
        })
        render()
      }
      const part = (i: number): FakeNode => dom!.query(`[data-part-key="${blocks[i].key}"]`)!
      function expectMounted(view: number, focus: number): void {
        const expected = new Set([0])
        for (const center of [view, focus]) {
          for (let i = Math.max(0, center - 2); i <= Math.min(count - 1, center + 2); i++)
            expected.add(i)
        }
        expect(
          dom!.queryAll('[data-index]').map((n) => Number(n.getAttribute('data-index')))
        ).toEqual([...expected].sort((a, b) => a - b))
      }
      render()
      select(part(0), 0, part(1), 1)
      const steps = [
        298,
        300,
        298,
        299,
        count - 1,
        9,
        count - 1,
        ...Array.from({ length: 20 }, (_, i) => count - 2 - i * 4)
      ]
      const pageDownTaskMs: number[] = []
      for (const [step, focus] of steps.entries()) {
        scrollTo(focus)
        const start = performance.now()
        select(part(0), 0, part(focus), 2)
        const key = step < 4 ? 'ArrowDown' : step === 6 ? 'End' : 'PageDown'
        const viewport = dom!.query('[data-transcript-viewport]')!
        dom!.act(() =>
          (viewport.props.onKeyDown as (e: { shiftKey: boolean; key: string }) => void)({
            shiftKey: true,
            key
          })
        )
        if (step >= steps.length - 20) pageDownTaskMs.push(performance.now() - start)
        expectMounted(focus, focus)
        scrollTo(125)
        expectMounted(125, focus)
        scrollTo(0)
        expectMounted(0, focus)
      }
      expect(pageDownTaskMs).toHaveLength(20)
      expect(pageDownTaskMs.every((ms) => Number.isFinite(ms) && ms >= 0)).toBe(true)
      if (process.env.TRANSCRIPT_SELECTION_TIMINGS) {
        process.stdout.write(JSON.stringify({ blocks: count, pageDownTaskMs }) + '\n')
      }
    }
  )

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

  it.each([
    'sync',
    'sync throw',
    'chunks',
    'new snapshot between chunks',
    'replace snapshot between chunks',
    'forward chunks',
    'forward sync',
    'sync offsets',
    'element boundary',
    'external reset',
    'collapsed key',
    'unmarked change',
    'unmarked key',
    'cleared between tasks',
    'foreign anchor',
    'foreign focus',
    'collapsed endpoint',
    'new session should ignore saved endpoints',
    'owner by key',
    'owner by part',
    'anchor removed',
    'focus removed',
    'restore endpoints',
    'cap + 1',
    'wrapper boundaries',
    'focus moved',
    'inert',
    'switch',
    'unmount',
    'supersede',
    'reject',
    'selection lost',
    'start lost',
    'end lost'
  ] as const)('c3/c7/c12/c19: onCopy copies a partial reverse range (%s)', async (mode) => {
    const chunked =
      mode !== 'sync' && mode !== 'sync throw' && mode !== 'forward sync' && mode !== 'sync offsets'
    const chunkCounts = mode === 'cap + 1' ? [4, 1] : [2, 2, 1]
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
    const movedOwner = mode === 'owner by key' || mode === 'owner by part'
    if (movedOwner) blocks[4] = { ...blocks[4], partKeys: ['retained-part'] }
    const snapshot = createBlockList(blocks).snapshot()
    const readWidth = vi.fn(() => 600)
    const scrollRef = {
      current: {
        scrollTop: 0,
        clientHeight: 40,
        get clientWidth() {
          return readWidth()
        },
        getBoundingClientRect: () => ({ top: 0, bottom: 40, width: 600, height: 40 }),
        querySelectorAll: (selector: string) => dom!.queryAll(selector),
        querySelector: (selector: string) => dom!.query(selector),
        contains: (node: Node) => dom!.container.contains(node),
        addEventListener: () => {},
        removeEventListener: () => {},
        scrollTo: () => {}
      } as unknown as HTMLDivElement
    }
    const timings: CopyTaskTiming[] = []
    function render(overscan: number, sessionKey = 'before', current = snapshot): void {
      dom!.render(
        createElement(TranscriptViewport<SimpleBlock>, {
          snapshot: current,
          sessionKey,
          scrollRef,
          overscan,
          anchorKey: blocks[5].key,
          estimateSizePx: 80,
          copyChunkSize: chunked && !movedOwner ? chunkCounts[0] : 5,
          onCopyTiming: (timing) => {
            timings.push(timing)
            if (mode === 'sync throw') throw new Error('copy interrupted')
          },
          hasPartMarkers: (block) =>
            mode === 'wrapper boundaries' && (block === blocks[0] || block === blocks[4]),
          renderBlock: (block, index, selected) =>
            createElement('p', { 'data-picked': selected ? index : undefined }, block.text)
        })
      )
    }
    const part = (index: number): FakeNode => {
      const attr =
        mode === 'wrapper boundaries' && (index === 0 || index === 4)
          ? 'data-block-key'
          : 'data-part-key'
      return dom!.query(`[${attr}="${blocks[index].partKeys?.[0] ?? blocks[index].key}"]`)!
    }

    // Use the DOM with all rows mounted as the independent plain-text reference.
    setVirtualization(false)
    render(6)
    if (mode === 'forward chunks' || mode === 'forward sync') select(part(0), 6, part(4), 12)
    else select(part(4), 12, part(0), 6)
    expect(dom.query('[data-transcript-viewport]')!.props.onCopy).toBeUndefined()
    const reference = selection.toString()
    expect(reference.split('\n').length).toBeGreaterThan(2)

    setVirtualization(true)
    render(6)
    if (mode === 'forward chunks' || mode === 'forward sync') select(part(0), 6, part(4), 12)
    else select(part(4), 12, part(0), 6)
    const selectedRows = (): number[] =>
      dom!.queryAll('[data-picked]').map((row) => Number(row.getAttribute('data-picked')))
    if (mode === 'external reset') {
      const other = dom.createNode('div')
      selection.setBaseAndExtent(other, 0, other, 0)
      render(6, 'before', createBlockList(blocks).snapshot())
      expect(selection.anchorNode).toBe(other)
      expect(selection.focusNode).toBe(other)
      return
    }
    if (mode === 'collapsed key' || mode === 'unmarked change' || mode === 'unmarked key') {
      if (mode === 'collapsed key') {
        selection.setBaseAndExtent(selection.focusNode!, 1, selection.focusNode!, 1)
      } else {
        const unmarked = dom.createNode('div', { 'data-index': 2 })
        unmarked.parent = dom.container
        selection.setBaseAndExtent(selection.anchorNode!, 12, unmarked, 0)
      }
      if (mode === 'unmarked change') {
        dom.act(() => {
          for (const listener of dom!.documentListeners.get('selectionchange') ?? []) listener({})
        })
      } else {
        const handler = dom.query('[data-transcript-viewport]')!.props.onKeyDown as (event: {
          key: string
          shiftKey: boolean
        }) => void
        dom.act(() => handler({ key: 'PageDown', shiftKey: true }))
      }
      selection.removeAllRanges()
      render(6, 'before', createBlockList(blocks).snapshot())
      expect(selectedRows()).toEqual([0, 1, 2, 3, 4])
      expect([selection.anchorOffset, selection.focusOffset]).toEqual([12, 6])
      return
    }
    if (mode === 'element boundary') {
      selection.setBaseAndExtent(part(4), 1, part(0), 0)
      dom.act(() => {
        for (const listener of dom!.documentListeners.get('selectionchange') ?? []) listener({})
      })
      selection.removeAllRanges()
      render(6, 'before', createBlockList(blocks).snapshot())
      expect(selection.anchorNode?.closest('[data-part-key]')).toBe(part(4))
      expect(selection.focusNode?.closest('[data-part-key]')).toBe(part(0))
      expect([selection.anchorOffset, selection.focusOffset]).toEqual([blocks[4].text.length, 0])
      return
    }
    if (mode === 'foreign anchor' || mode === 'foreign focus') {
      const outside = dom.createNode('div', {
        'data-index': 1,
        'data-block-key': blocks[1].key,
        'data-part-key': blocks[1].key
      })
      if (mode === 'foreign anchor') selection.setBaseAndExtent(outside, 0, selection.focusNode!, 6)
      else selection.setBaseAndExtent(selection.anchorNode!, 12, outside, 0)
      dom.act(() => {
        for (const listener of dom!.documentListeners.get('selectionchange') ?? []) listener({})
      })
      expect(selectedRows()).toEqual([0, 1, 2, 3, 4])
      return
    }
    if (mode === 'collapsed endpoint' || mode === 'new session should ignore saved endpoints') {
      if (mode === 'collapsed endpoint') select(part(1), 0, part(1), 0)
      else render(6, 'after')
      expect(selectedRows()).toEqual([])
      return
    }
    if (movedOwner) {
      const next = [...blocks]
      next[4] = { ...next[4], partKeys: ['replacement'] }
      next[2] =
        mode === 'owner by key'
          ? { ...next[2], key: 'retained-part', partKeys: undefined }
          : { ...next[2], partKeys: ['retained-part'] }
      selection.removeAllRanges()
      render(6, 'before', createBlockList(next).snapshot())
      expect(selectedRows()).toEqual([0, 1, 2])
      const onCopy = dom.query('[data-transcript-viewport]')!.props.onCopy as (event: {
        preventDefault: () => void
      }) => void
      const preventDefault = vi.fn()
      dom.act(() => onCopy({ preventDefault }))
      expect(preventDefault).not.toHaveBeenCalled()
      expect(timings.map(({ kind, blockCount }) => [kind, blockCount])).toEqual([['handler', 3]])
      return
    }
    if (mode === 'anchor removed' || mode === 'focus removed') {
      const missing = mode === 'anchor removed' ? 4 : 0
      render(
        6,
        'before',
        createBlockList(blocks.filter((_, index) => index !== missing)).snapshot()
      )
      const preventDefault = vi.fn()
      const onCopy = dom.query('[data-transcript-viewport]')!.props.onCopy as (e: {
        preventDefault: () => void
      }) => void
      dom.act(() => onCopy({ preventDefault }))
      await vi.runAllTimersAsync()
      expect(preventDefault).not.toHaveBeenCalled()
      expect(timings).toEqual([])
      expect(selectedRows()).toEqual([])
      expect(write).not.toHaveBeenCalled()
      return
    }
    if (mode === 'restore endpoints') {
      const a = selection.anchorNode!
      const f = selection.focusNode!
      const points: Array<[FakeNode, number, FakeNode, number]> = [
        [f, 12, f, 6],
        [a, 11, f, 6],
        [a, 12, a, 6],
        [a, 12, f, 5]
      ]
      for (const point of points) {
        selection.setBaseAndExtent(...point)
        render(6, 'before', createBlockList(blocks).snapshot())
        expect([
          selection.anchorNode,
          selection.anchorOffset,
          selection.focusNode,
          selection.focusOffset
        ]).toEqual([a, 12, f, 6])
      }
    }
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
    const heightReads = chunked ? undefined : vi.spyOn(FakeNode.prototype, 'getBoundingClientRect')
    readWidth.mockClear()
    if (mode === 'sync offsets')
      selection.setBaseAndExtent(selection.anchorNode!, 1, selection.focusNode!, 2)
    const dispatchCopy = (): void => dom!.act(() => onCopy({ preventDefault }))
    if (mode === 'sync throw') expect(dispatchCopy).toThrow('copy interrupted')
    else dispatchCopy()
    expect(readWidth).not.toHaveBeenCalled()

    if (!chunked) {
      expect(preventDefault).not.toHaveBeenCalled()
      expect(timings).toEqual([{ kind: 'handler', blockCount: 5, durationMs: expect.any(Number) }])
      expect(part(2)).not.toBeNull()
      // A row mounted only for native copy leaves the reading viewport's measurements alone.
      expect(heightReads!.mock.contexts).not.toContain(part(2))
      expect(part(5)).not.toBeNull()
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
    if (mode === 'reject' || mode.endsWith('lost')) {
      const report = vi.spyOn(errors, 'reportError').mockImplementation(() => {})
      if (mode === 'reject') write.mockRejectedValueOnce(new Error('clipboard denied'))
      if (mode === 'selection lost') vi.spyOn(document, 'getSelection').mockReturnValue(null)
      if (mode === 'start lost' || mode === 'end lost') {
        const missingKey = blocks[mode === 'start lost' ? 0 : 4].key
        const query = FakeNode.prototype.querySelector
        vi.spyOn(FakeNode.prototype, 'querySelector').mockImplementation(function (
          this: FakeNode,
          selector
        ) {
          if (
            this.closest('[data-copy-serialization-host]') &&
            selector === `[data-part-key="${missingKey}"]`
          )
            return null
          return query.call(this, selector)
        })
      }
      await vi.runAllTimersAsync()
      expect(write).toHaveBeenCalledTimes(mode === 'reject' ? 1 : 0)
      expect(report).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ event: 'clipboard.copy.failed' })
      )
      expect(dom.query('[data-copy-serialization-host]')).toBeNull()
      expect([
        selection.anchorNode,
        selection.anchorOffset,
        selection.focusNode,
        selection.focusOffset
      ]).toEqual(endpoints)
      return
    }
    if (mode === 'new snapshot between chunks' || mode === 'replace snapshot between chunks') {
      await vi.advanceTimersToNextTimerAsync()
      const next =
        mode === 'new snapshot between chunks'
          ? blocks.filter((_, index) => index !== 2)
          : [...blocks]
      next[2] = { ...next[2], text: 'new text from a later snapshot' }
      render(0, 'before', createBlockList(next).snapshot())
      await vi.runAllTimersAsync()
      expect(write).toHaveBeenCalledOnce()
      expect(await write.mock.calls[0][0][0]['text/plain'].text()).toBe(reference)
      return
    }
    if (mode === 'unmount' || mode === 'supersede') {
      await vi.advanceTimersToNextTimerAsync()
      if (mode === 'unmount') dom.unmount()
      else dom.act(() => onCopy({ preventDefault }))
      await vi.runAllTimersAsync()
      expect(write).toHaveBeenCalledTimes(mode === 'supersede' ? 1 : 0)
      if (mode === 'supersede')
        expect(await write.mock.calls[0][0][0]['text/plain'].text()).toBe(reference)
      return
    }
    if (mode === 'switch') {
      await vi.advanceTimersToNextTimerAsync()
      render(0, 'after')
      await vi.runAllTimersAsync()
      expect(write).not.toHaveBeenCalled()
      expect(timings.map(({ kind }) => kind)).toEqual(['handler', 'chunk'])
      return
    }
    if (mode === 'cleared between tasks') {
      selection.removeAllRanges()
      await vi.runAllTimersAsync()
      expect(selection.rangeCount).toBe(0)
      expect(await write.mock.calls[0][0][0]['text/plain'].text()).toBe(reference)
      return
    }
    const focused = dom.createNode('button')
    focused.focus()
    const restoreFocus = vi.spyOn(focused, 'focus')
    if (mode === 'focus moved') {
      const other = dom.createNode('button')
      const create = document.createRange.bind(document)
      vi.spyOn(document, 'createRange').mockImplementation(() => {
        const range = create()
        const clone = range.cloneContents.bind(range)
        range.cloneContents = () => {
          other.focus()
          return clone()
        }
        return range
      })
    }
    for (let chunk = 0; chunk < chunkCounts.length; chunk++) {
      if (mode === 'inert' && chunk === 1) dom.container.props.inert = true
      await vi.advanceTimersToNextTimerAsync()
      expect(dom.query('[data-copy-serialization-host]')).toBeNull()
      expect([
        selection.anchorNode,
        selection.anchorOffset,
        selection.focusNode,
        selection.focusOffset
      ]).toEqual(endpoints)
      expect(write).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(focused)
    }
    if (mode === 'focus moved') expect(restoreFocus).toHaveBeenCalledWith({ preventScroll: true })
    else expect(restoreFocus).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(write).toHaveBeenCalledOnce()
    expect(await write.mock.calls[0][0][0]['text/plain'].text()).toBe(reference)
    expect((await write.mock.calls[0][0][0]['text/html'].text()).length).toBeGreaterThan(0)
    expect(timings.map(({ kind, blockCount }) => [kind, blockCount])).toEqual([
      ['handler', 0],
      ...chunkCounts.map((count) => ['chunk', count]),
      ['assemble', 5]
    ])
  })

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
    expect(host?.parent).toBe(dom.body)
    expect(host!.getAttribute('aria-hidden')).toBe('true')
    expect(host!.getAttribute('inert')).toBeNull()
    const cls = host!.getAttribute('class') ?? ''
    expect(cls.split(' ')).toEqual(expect.arrayContaining(['fixed', 'top-0', 'left-[-99999px]']))
    expect(cls).toContain('select-text')
    expect(cls).toContain('pointer-events-none')
    expect(cls).not.toContain('select-none')
  })
})
