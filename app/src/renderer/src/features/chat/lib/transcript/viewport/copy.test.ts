import { describe, expect, it, vi } from 'vitest'
import { selectionMountSet } from './range'
import { startCopyJob, type CopyTaskTiming } from './copy'
import {
  isVirtualizationEnabled,
  setVirtualization
} from '../../../components/transcript/TranscriptViewport'

vi.mock('../../../../../shared/errors/reportError', () => ({
  reportError: vi.fn()
}))

import { reportError } from '../../../../../shared/errors/reportError'

describe('viewport/range & copy (EP-17 · c1~c19)', () => {
  it('c1/c2/c10/c15: selectionMountSet never mounts full selected range (300, 301, 5000 blocks)', () => {
    for (const focusIndex of [300, 301, 4999]) {
      const mounted = selectionMountSet(
        { startIndex: 0, endIndex: 10, overscan: 6, count: 5000 },
        { anchorIndex: 2, focusIndex },
        5
      )
      // Must contain visible ± 6, anchor (2), focus ± 6, viewportAnchor (5)
      expect(mounted).toContain(2)
      expect(mounted).toContain(focusIndex)
      expect(mounted).toContain(5)
      // Must NOT mount the middle of the selection (e.g. index 150)
      expect(mounted).not.toContain(150)
      // Bounded size (≤ visible+overscan + focus+overscan + 2)
      expect(mounted.length).toBeLessThanOrEqual(40)
    }
  })

  it('mounts an isolated viewport anchor without expanding its neighborhood', () => {
    const mounted = selectionMountSet(
      { startIndex: 10, endIndex: 12, overscan: 1, count: 100 },
      { anchorIndex: 20, focusIndex: 22 },
      73
    )
    expect(mounted).toEqual([9, 10, 11, 12, 13, 20, 21, 22, 23, 73])
  })

  it('c7/c12: chunked async copy splits on block boundaries, unmounts after each chunk, writes clipboard once in assemble task', async () => {
    const queue: (() => void)[] = []
    const events: string[] = []
    const timings: CopyTaskTiming[] = []
    let writtenText = ''
    let writtenHtml = ''
    let writeCount = 0

    const job = startCopyJob(
      0,
      9,
      {
        mountChunk: (s, e) => events.push(`mount:${s}-${e}`),
        serializeChunk: (s, e) => {
          events.push(`ser:${s}-${e}`)
          return { text: `chunk(${s}-${e})`, html: `<p>${s}-${e}</p>` }
        },
        unmountChunk: () => events.push('unmount'),
        scheduleNext: (fn) => queue.push(fn),
        writeClipboard: async (text, html) => {
          writeCount++
          writtenText = text
          writtenHtml = html
        },
        onTiming: (t) => timings.push(t)
      },
      { chunkSize: 4 }
    )

    // 10 blocks / 4 = 3 chunks + 1 assemble = 4 scheduled tasks
    let tasksRun = 0
    while (queue.length > 0) {
      const fn = queue.shift()!
      tasksRun++
      fn()
    }
    const ok = await job.done
    expect(ok).toBe(true)
    expect(tasksRun).toBe(4)
    expect(writeCount).toBe(1)
    expect(writtenText).toBe('chunk(0-3)\nchunk(4-7)\nchunk(8-9)')
    expect(writtenHtml).toBe('<p>0-3</p><p>4-7</p><p>8-9</p>')
    expect(events).toEqual([
      'mount:0-3',
      'ser:0-3',
      'unmount',
      'mount:4-7',
      'ser:4-7',
      'unmount',
      'mount:8-9',
      'ser:8-9',
      'unmount'
    ])
    expect(timings.map((t) => t.kind)).toEqual(['chunk', 'chunk', 'chunk', 'assemble'])
  })

  it('c13: chunk failure stops remaining chunks, unmounts, writes 0 to clipboard, and reports clipboard.copy.failed', async () => {
    vi.mocked(reportError).mockClear()
    const queue: (() => void)[] = []
    const mounts: [number, number][] = []
    let unmountCount = 0
    let writeCount = 0

    const job = startCopyJob(
      0,
      9,
      {
        mountChunk: (start, end) => mounts.push([start, end]),
        serializeChunk: (s) => {
          if (s === 4) throw new Error('chunk boom')
          return { text: 'ok', html: 'ok' }
        },
        unmountChunk: () => {
          unmountCount++
        },
        scheduleNext: (fn) => queue.push(fn),
        writeClipboard: async () => {
          writeCount++
        }
      },
      { chunkSize: 4 }
    )

    while (queue.length > 0) queue.shift()!()
    const ok = await job.done
    expect(ok).toBe(false)
    expect(mounts).toEqual([
      [0, 3],
      [4, 7]
    ])
    expect(unmountCount).toBe(2) // chunk 1 + chunk 2 finally
    expect(writeCount).toBe(0)
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'clipboard.copy.failed',
        scope: 'clipboard',
        title: 'copyFailed'
      })
    )
  })

  it('c16: cancelling an in-flight copy job suppresses clipboard write', async () => {
    const queue: (() => void)[] = []
    let writeCount = 0
    const job = startCopyJob(
      0,
      7,
      {
        mountChunk: () => {},
        serializeChunk: () => ({ text: 'x', html: 'x' }),
        unmountChunk: () => {},
        scheduleNext: (fn) => queue.push(fn),
        writeClipboard: async () => {
          writeCount++
        }
      },
      { chunkSize: 4 }
    )

    // Run first chunk, then cancel
    queue.shift()!()
    job.cancel()
    while (queue.length > 0) queue.shift()!()
    const ok = await job.done
    expect(ok).toBe(false)
    expect(writeCount).toBe(0)
  })

  it('c17: setVirtualization toggles global virtualization mode cleanly', () => {
    expect(isVirtualizationEnabled()).toBe(true)
    setVirtualization(false)
    expect(isVirtualizationEnabled()).toBe(false)
    setVirtualization(true)
    expect(isVirtualizationEnabled()).toBe(true)
  })
})
