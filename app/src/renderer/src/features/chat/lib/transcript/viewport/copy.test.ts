import { describe, expect, it, vi } from 'vitest'
import { selectionMountSet } from './range'
import { SELECTION_COPY_SYNC_MAX_BLOCKS, startCopyJob, type CopyTaskTiming } from './copy'
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

  it('keeps only surviving endpoints after a selection row disappears (c1/c6/c15)', () => {
    const visible = { startIndex: 8, endIndex: 9, overscan: 2, count: 15 }
    const window = [6, 7, 8, 9, 10, 11]
    expect(selectionMountSet(visible, { anchorIndex: -1, focusIndex: 14 })).toEqual([
      ...window,
      12,
      13,
      14
    ])
    expect(selectionMountSet(visible, { anchorIndex: 14, focusIndex: -1 })).toEqual([...window, 14])
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

  it('joins reversed chunks across empty rows and preserves both partial boundaries', async () => {
    const rows = [
      { text: '', leadingBreaks: 5, trailingBreaks: 3 },
      { text: 'a', leadingBreaks: 0, trailingBreaks: 3 },
      { text: '', leadingBreaks: 6, trailingBreaks: 7 },
      { text: 'b', leadingBreaks: 2, trailingBreaks: 0 },
      { text: 'c', leadingBreaks: 0, trailingBreaks: 2 },
      { text: '', leadingBreaks: 3, trailingBreaks: 0 }
    ]
    const tasks: Array<() => void> = []
    const writeClipboard = vi.fn(async () => {})
    const serializeChunk = vi.fn((start: number) => ({
      ...rows[start - 3],
      html: '<p>' + start + '</p>'
    }))
    const timings: CopyTaskTiming[] = []
    let clock = 0
    const job = startCopyJob(
      8,
      3,
      {
        mountChunk: () => {},
        unmountChunk: () => {},
        serializeChunk,
        scheduleNext: (task) => tasks.push(task),
        writeClipboard,
        now: () => (clock += 2),
        onTiming: (sample) => timings.push(sample)
      },
      { chunkSize: 1 }
    )
    while (tasks.length) tasks.shift()!()
    expect(await job.done).toBe(true)
    expect(serializeChunk.mock.calls).toEqual([
      [3, 3, true, false],
      [4, 4, false, false],
      [5, 5, false, false],
      [6, 6, false, false],
      [7, 7, false, false],
      [8, 8, false, true]
    ])
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith(
      '\n\na' + '\n'.repeat(4) + 'bc' + '\n'.repeat(4),
      '<p>3</p><p>4</p><p>5</p><p>6</p><p>7</p><p>8</p>'
    )
    expect(timings).toEqual([
      ...Array.from({ length: 6 }, () => ({ kind: 'chunk', durationMs: 2, blockCount: 1 })),
      { kind: 'assemble', durationMs: 2, blockCount: 6 }
    ])
  })

  it.each([false, true])(
    'settles a cancelled job when clipboard write started=%s',
    async (started) => {
      const tasks: Array<() => void> = []
      let finish = (): void => {}
      const writeClipboard = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve
          })
      )
      const job = startCopyJob(2, 2, {
        mountChunk: () => {},
        unmountChunk: () => {},
        serializeChunk: () => ({ text: 'x', html: '<p>x</p>' }),
        scheduleNext: (task) => tasks.push(task),
        writeClipboard
      })
      tasks.shift()!()
      if (started) tasks.shift()!()
      job.cancel()
      if (!started) tasks.shift()!()
      finish()
      expect(await job.done).toBe(false)
      expect(writeClipboard).toHaveBeenCalledTimes(started ? 1 : 0)
    }
  )

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

  it.each(['mount', 'serialize', 'unmount'] as const)(
    'c13: %s error aborts the job and releases the chunk',
    async (phase) => {
      vi.mocked(reportError).mockClear()
      const tasks: Array<() => void> = []
      const fail = (where: string): void => {
        if (where === phase) throw new Error(where)
      }
      const unmountChunk = vi.fn(() => fail('unmount'))
      const onTiming = vi.fn()
      const writeClipboard = vi.fn(async () => {})
      const copy = startCopyJob(
        0,
        2,
        {
          scheduleNext: (task) => tasks.push(task),
          mountChunk: () => fail('mount'),
          serializeChunk: () => {
            fail('serialize')
            return { text: 'text', html: 'text' }
          },
          unmountChunk,
          onTiming,
          writeClipboard
        },
        { chunkSize: 1 }
      )
      expect(tasks.shift()!).not.toThrow()
      expect(tasks).toHaveLength(0)
      expect(await copy.done).toBe(false)
      expect(unmountChunk).toHaveBeenCalledOnce()
      expect(onTiming).not.toHaveBeenCalled()
      expect(writeClipboard).not.toHaveBeenCalled()
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ event: 'clipboard.copy.failed', error: new Error(phase) })
      )
    }
  )

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

  it.each([undefined, { clipboard: {} }])(
    'reports an unavailable native clipboard',
    async (navigator) => {
      vi.mocked(reportError).mockClear()
      vi.stubGlobal('navigator', navigator)
      try {
        const tasks: Array<() => void> = []
        const job = startCopyJob(0, 0, {
          mountChunk: () => {},
          unmountChunk: () => {},
          serializeChunk: () => ({ text: 'x', html: 'x' }),
          scheduleNext: (task) => tasks.push(task)
        })
        tasks.shift()!()
        tasks.shift()!()
        expect(await job.done).toBe(false)
        expect(reportError).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            event: 'clipboard.copy.failed',
            error: new Error('Clipboard API unavailable')
          })
        )
      } finally {
        vi.unstubAllGlobals()
      }
    }
  )

  it('stops assembly if a clipboard writer throws synchronously', async () => {
    vi.mocked(reportError).mockClear()
    const tasks: Array<() => void> = []
    const error = new Error('write unavailable')
    const job = startCopyJob(0, 0, {
      mountChunk: () => {},
      unmountChunk: () => {},
      serializeChunk: () => ({ text: 'x', html: 'x' }),
      scheduleNext: (task) => tasks.push(task),
      writeClipboard: () => {
        throw error
      }
    })
    tasks.shift()!()
    expect(tasks.shift()!).not.toThrow()
    expect(await job.done).toBe(false)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ error }))
  })

  it('can cancel before its first scheduled chunk touches the DOM', async () => {
    const tasks: Array<() => void> = []
    const mountChunk = vi.fn()
    const job = startCopyJob(0, 0, {
      mountChunk,
      unmountChunk: () => {},
      serializeChunk: () => ({ text: 'x', html: 'x' }),
      scheduleNext: (task) => tasks.push(task)
    })
    job.cancel()
    tasks.shift()!()
    expect(mountChunk).not.toHaveBeenCalled()
    expect(tasks).toHaveLength(0)
    expect(await job.done).toBe(false)
  })

  it('stops scheduling immediately if cancellation arrives inside a serialization task', async () => {
    const tasks: Array<() => void> = []
    const unmountChunk = vi.fn()
    const writeClipboard = vi.fn(async () => {})
    const job = startCopyJob(
      0,
      3,
      {
        mountChunk: () => {},
        serializeChunk: () => {
          job.cancel()
          return { text: 'discarded', html: 'discarded' }
        },
        unmountChunk,
        writeClipboard,
        scheduleNext: (task) => tasks.push(task)
      },
      { chunkSize: 2 }
    )
    tasks.shift()!()
    expect(tasks).toHaveLength(0)
    expect(await job.done).toBe(false)
    expect(unmountChunk).toHaveBeenCalledOnce()
    expect(writeClipboard).not.toHaveBeenCalled()
  })

  it('ignores a late rejection after the pending native write was cancelled', async () => {
    vi.mocked(reportError).mockClear()
    const tasks: Array<() => void> = []
    const write = Promise.withResolvers<void>()
    const job = startCopyJob(0, 0, {
      mountChunk: () => {},
      serializeChunk: () => ({ text: 'x', html: 'x' }),
      unmountChunk: () => {},
      scheduleNext: (task) => tasks.push(task),
      writeClipboard: () => write.promise
    })
    tasks.shift()!()
    tasks.shift()!()
    job.cancel()
    write.reject(new Error('superseded'))
    expect(await job.done).toBe(false)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('uses the default cap and yields a separate native write when scheduling is omitted', async () => {
    vi.useFakeTimers()
    try {
      const mountChunk = vi.fn()
      const writeClipboard = vi.fn(async () => {})
      const cap = SELECTION_COPY_SYNC_MAX_BLOCKS
      const job = startCopyJob(0, cap, {
        mountChunk,
        serializeChunk: () => ({ text: 'x', html: 'x' }),
        unmountChunk: () => {},
        writeClipboard
      })
      expect(mountChunk).not.toHaveBeenCalled()
      await vi.advanceTimersToNextTimerAsync()
      expect(mountChunk.mock.calls).toEqual([[0, cap - 1]])
      await vi.advanceTimersToNextTimerAsync()
      expect(mountChunk.mock.calls).toEqual([
        [0, cap - 1],
        [cap, cap]
      ])
      expect(writeClipboard).not.toHaveBeenCalled()
      await vi.advanceTimersToNextTimerAsync()
      expect(await job.done).toBe(true)
      expect(writeClipboard).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('c17: setVirtualization toggles global virtualization mode cleanly', () => {
    expect(isVirtualizationEnabled()).toBe(true)
    setVirtualization(false)
    expect(isVirtualizationEnabled()).toBe(false)
    setVirtualization(true)
    expect(isVirtualizationEnabled()).toBe(true)
  })
})
