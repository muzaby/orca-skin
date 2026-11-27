import { useWorkerRetry } from '../../../../shared/compute/useWorkerRetry'
import { useEffect, useRef, useState } from 'react'
import {
  computeClient,
  type ComputeHandle,
  type DocumentLease,
  type Priority
} from '../../../../shared/compute/client'
import type { ComputeResults } from '../../../../shared/compute/protocol'
import { CodeBlock } from '../../../../shared/ui/markdown/CodeBlock'
import {
  sliceSourceParts,
  type MarkdownSourcePart,
  type MarkedText
} from '../../../../shared/ui/markdown/sourceParts'
import type { MarkdownRow } from './useMarkdownRows'

interface FenceResult {
  row: MarkdownRow
  parts?: readonly MarkdownSourcePart[]
  code: string
  runs: MarkedText[]
}

// Only one physical source registration is held while the worker normalizes this
// logical fence. Keep the rendered code and its copy action together across cuts.
export function SegmentedFence({
  row,
  parts,
  priority,
  onSettled
}: {
  row: MarkdownRow
  parts?: readonly MarkdownSourcePart[]
  priority: Priority
  onSettled?: (parsed: boolean) => void
}): React.JSX.Element {
  const retryWorker = useWorkerRetry('markdown', row)
  const [result, setResult] = useState<FenceResult>()
  const [failed, setFailed] = useState<Pick<FenceResult, 'row' | 'parts'>>()
  const checkpoint = useRef<(FenceResult & { next: number }) | undefined>(undefined)
  const rank = useRef(priority)
  const running = useRef<ComputeHandle<ComputeResults['markdown']> | undefined>(undefined)
  useEffect(() => {
    rank.current = priority
    running.current?.setPriority(priority)
  }, [priority])
  useEffect(() => {
    const pieces = row.fencePieces
    const fence = row.block.fence
    const read = row.readSource
    if (!pieces || !fence || !read) return
    let lease: DocumentLease | undefined
    let unsubscribe: (() => void) | undefined
    let active = true
    const saved = checkpoint.current
    const resume = saved?.row === row && saved.parts === parts ? saved : undefined
    let index = resume?.next ?? 0
    let code = resume?.code ?? ''
    const runs: MarkedText[] = resume?.runs ?? []
    const client = computeClient()
    function release(): void {
      unsubscribe?.()
      unsubscribe = undefined
      lease?.release()
      lease = undefined
    }
    function next(): void {
      while (active && pieces && fence && read && index < pieces.length) {
        const { doc, segment, block } = pieces[index++]
        const start = Math.max(segment.start + block.start, fence.bodyStart)
        const end = Math.min(segment.start + block.end, fence.bodyEnd)
        if (start >= end) continue
        const localParts = sliceSourceParts(parts, start, end)
        const lineStart = start === fence.bodyStart || /[\r\n]/.test(read(start - 1, start))
        const range = { indent: fence.indent, lineStart, parts: localParts }
        lease = client.openDocument(doc, { text: segment.text, read: segment.read }, 'markdown')
        const startJob = (): void => {
          const job = retryWorker(() =>
            client.request<'markdown'>(
              {
                kind: 'markdown',
                doc,
                start: start - segment.start,
                end: end - segment.start,
                fence: range
              },
              { cacheable: false, priority: rank.current }
            )
          )
          running.current = job
          void job.promise
            .then(({ hast }) => {
              if (!active) return
              for (const node of hast.children) {
                if (node.type !== 'text') throw Error('Invalid fenced code response')
                code += node.value
                const key = node.data?.partKey
                if (typeof key !== 'string') continue
                const last = runs.at(-1)
                if (last?.key === key) runs[runs.length - 1] = { key, text: last.text + node.value }
                else runs.push({ key, text: node.value })
              }
              running.current = undefined
              release()
              next()
            })
            .catch(() => {
              if (active) {
                release()
                checkpoint.current = { row, parts, code, runs, next: index - 1 }
                setFailed({ row, parts })
              }
            })
        }
        if (lease.available) startJob()
        else unsubscribe = lease.onAvailable(startJob)
        return
      }
      if (active) {
        checkpoint.current = undefined
        setFailed(undefined)
        setResult({ row, parts, code, runs })
      }
    }
    next()
    return () => {
      active = false
      running.current?.cancel()
      running.current = undefined
      release()
    }
  }, [row, parts, retryWorker])
  const complete = result?.row === row && result.parts === parts
  const rejected = failed?.row === row && failed.parts === parts
  useEffect(() => {
    if (complete || rejected) onSettled?.(complete)
  }, [complete, rejected, onSettled])
  const fence = row.block.fence
  if (rejected && fence)
    return (
      <pre data-md-block-error="" className="whitespace-pre-wrap break-words">
        {row.readSource?.(fence.start, fence.end)}
      </pre>
    )
  if (!complete) return <span data-md-block-pending="" />
  return <CodeBlock code={result.code} lang={row.block.fence?.lang} markedText={result.runs} />
}
