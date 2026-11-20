/**
 * Selection copy policy — sync copy (≤ SELECTION_COPY_SYNC_MAX_BLOCKS) and chunked async
 * copy (> cap) via CopySerializationHost (EP-17 ②~④⑥⑦ · D-087 · D-094 · D-101 · c3~c5, c7~c9, c12~c19).
 */
import { reportError } from '../../../../../shared/errors/reportError'

export { UI_TASK_BUDGET_MS } from '../../../../../../../shared/perf-budget'

// Chromium 154, Linux, 2026-11-20 (5 cores, load 4.61): 12 blocks, sync medians
// 4.7, 5.9, 5.5 ms (Code, Work, OpenCode); J9 0.02 ms. Long selections still exceed budget (0326 AC26).
export const SELECTION_COPY_SYNC_MAX_BLOCKS = 12

export interface RetainedSelectionEndpoint {
  readonly blockKey: string
  readonly partKey: string
  readonly charOffset: number
  /** Selection belongs to the row wrapper outside any marked part. */
  readonly blockWrapper?: true
}

export interface RetainedSelection {
  readonly anchor: RetainedSelectionEndpoint
  readonly focus: RetainedSelectionEndpoint
}

export interface CopyTaskTiming {
  readonly kind: 'handler' | 'chunk' | 'assemble'
  readonly durationMs: number
  readonly blockCount: number
}

export interface CopyJobHooks {
  readonly mountChunk: (startIndex: number, endIndex: number) => void
  readonly serializeChunk: (
    startIndex: number,
    endIndex: number,
    isFirst: boolean,
    isLast: boolean
  ) => { text: string; html: string; leadingBreaks?: number; trailingBreaks?: number }
  readonly unmountChunk: () => void
  readonly scheduleNext?: (fn: () => void) => void
  readonly writeClipboard?: (text: string, html: string) => Promise<void>
  readonly onTiming?: (timing: CopyTaskTiming) => void
  readonly now?: () => number
}

export interface CopyJobHandle {
  readonly generation: number
  cancel(): void
  readonly done: Promise<boolean>
}

async function defaultWriteClipboard(text: string[], html: BlobPart[]): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard API unavailable')
  }
  const textBlob = new Blob(text, { type: 'text/plain' })
  const htmlBlob = new Blob(html, { type: 'text/html' })
  const item = new ClipboardItem({
    'text/plain': textBlob,
    'text/html': htmlBlob
  })
  await navigator.clipboard.write([item])
}

let nextCopyGeneration = 0

/**
 * Start a chunked asynchronous copy job for selections exceeding `SELECTION_COPY_SYNC_MAX_BLOCKS`.
 * Each chunk mounts at most `chunkSize` blocks inside `CopySerializationHost`, extracts plain/HTML
 * text, immediately unmounts in `finally`, and yields via `setTimeout(0)` before the next chunk.
 * A final assemble task builds Blobs/ClipboardItem and writes to `navigator.clipboard.write`.
 */
export function startCopyJob(
  startIndex: number,
  endIndex: number,
  hooks: CopyJobHooks,
  options: { readonly chunkSize?: number } = {}
): CopyJobHandle {
  const generation = ++nextCopyGeneration
  const lo = Math.min(startIndex, endIndex)
  const hi = Math.max(startIndex, endIndex)
  const chunkSize = Math.max(1, options.chunkSize ?? SELECTION_COPY_SYNC_MAX_BLOCKS)
  const schedule = hooks.scheduleNext ?? ((fn: () => void) => setTimeout(fn, 0))
  const now =
    hooks.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))

  let cancelled = false
  const textParts: string[] = []
  const htmlParts: BlobPart[] = []
  const htmlEncoder = hooks.writeClipboard ? null : new TextEncoder()
  let cursor = lo
  let previousBreaks = 0

  const done = new Promise<boolean>((resolve) => {
    function fail(err: unknown): void {
      if (cancelled) {
        resolve(false)
        return
      }
      cancelled = true
      reportError({
        event: 'clipboard.copy.failed',
        scope: 'clipboard',
        title: 'copyFailed',
        error: err
      })
      resolve(false)
    }

    function runAssemble(): void {
      if (cancelled) {
        resolve(false)
        return
      }
      const t0 = now()
      let promise: Promise<void>
      try {
        promise = hooks.writeClipboard
          ? hooks.writeClipboard(textParts.join(''), htmlParts.join(''))
          : defaultWriteClipboard(textParts, htmlParts)
      } catch (err) {
        fail(err)
        return
      }
      hooks.onTiming?.({
        kind: 'assemble',
        durationMs: now() - t0,
        blockCount: hi - lo + 1
      })
      promise.then(
        () => resolve(!cancelled),
        (err) => fail(err)
      )
    }

    function readChunk(start: number, end: number): ReturnType<CopyJobHooks['serializeChunk']> {
      try {
        hooks.mountChunk(start, end)
        return hooks.serializeChunk(start, end, start === lo, end === hi)
      } finally {
        hooks.unmountChunk()
      }
    }

    function runChunk(): void {
      if (cancelled) {
        resolve(false)
        return
      }
      const chunkStart = cursor
      const chunkEnd = Math.min(hi, chunkStart + chunkSize - 1)
      const isFirst = chunkStart === lo
      const isLast = chunkEnd === hi
      const t0 = now()
      try {
        const {
          text,
          html,
          leadingBreaks = 1,
          trailingBreaks = 1
        } = readChunk(chunkStart, chunkEnd)
        // The two edge measurements share one ordinary block break. A chunk of
        // empty interior rows contributes HTML but no new plain-text boundary.
        if (text || isFirst || isLast) {
          if (textParts.length)
            textParts.push('\n'.repeat(Math.max(0, previousBreaks + leadingBreaks - 1)))
          previousBreaks = trailingBreaks
          textParts.push(text)
        }
        // Encode HTML incrementally without allocating a browser-managed Blob for each chunk.
        // The injected string writer consumes the original HTML instead.
        htmlParts.push(htmlEncoder ? htmlEncoder.encode(html) : html)
      } catch (err) {
        fail(err)
        return
      }
      hooks.onTiming?.({
        kind: 'chunk',
        durationMs: now() - t0,
        blockCount: chunkEnd - chunkStart + 1
      })

      cursor = chunkEnd + 1
      if (cancelled) {
        resolve(false)
        return
      }
      if (cursor <= hi) {
        schedule(runChunk)
      } else {
        schedule(runAssemble)
      }
    }

    schedule(runChunk)
  })

  return {
    generation,
    cancel() {
      cancelled = true
    },
    done
  }
}
