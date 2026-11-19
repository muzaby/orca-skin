/**
 * Selection copy policy — sync copy (≤ SELECTION_COPY_SYNC_MAX_BLOCKS) and chunked async
 * copy (> cap) via CopySerializationHost (EP-17 ②~④⑥⑦ · D-087 · D-088 · D-094 · c3~c5, c7~c9, c12~c19).
 */
import { reportError } from '../../../../../shared/errors/reportError'

export const UI_TASK_BUDGET_MS = 50

// Calibrated by J9 (`app/scripts/measure-ui-inputs.mjs`, 100..2000 step 100, median ≤ 50ms):
// Node v24.22.3 linux/x64 VM measured cap = 2000 blocks (assemble 2500 = 1.10ms, 5000 = 2.53ms).
// Conservative 300-block sync threshold leaves headroom for real DOM serialization; refined on Windows in S5.
export const SELECTION_COPY_SYNC_MAX_BLOCKS = 300

export interface RetainedSelectionEndpoint {
  readonly blockKey: string
  readonly partKey: string
  readonly charOffset: number
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
  ) => { text: string; html: string }
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

async function defaultWriteClipboard(text: string, html: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write) {
    throw new Error('Clipboard API unavailable')
  }
  const textBlob = new Blob([text], { type: 'text/plain' })
  const htmlBlob = new Blob([html], { type: 'text/html' })
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
  const writeClip = hooks.writeClipboard ?? defaultWriteClipboard
  const now =
    hooks.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))

  let cancelled = false
  const textParts: string[] = []
  const htmlParts: string[] = []
  let cursor = lo

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
        const text = textParts.join('\n')
        const html = htmlParts.join('')
        promise = writeClip(text, html)
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
        hooks.mountChunk(chunkStart, chunkEnd)
        const { text, html } = hooks.serializeChunk(chunkStart, chunkEnd, isFirst, isLast)
        textParts.push(text)
        htmlParts.push(html)
      } catch (err) {
        fail(err)
        return
      } finally {
        hooks.unmountChunk()
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
