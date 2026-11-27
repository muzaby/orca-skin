import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Root, Element } from 'hast'
import { computeClient, type ComputeHandle, type Priority } from '../../../../shared/compute/client'
import { MARKDOWN_WORKER_MIN_CHARS } from '../../../../shared/compute/limits'
import type { ComputeResults } from '../../../../shared/compute/protocol'
import { Markdown, type MarkdownProps } from '../../../../shared/ui/markdown/Markdown'
import { MarkdownHast } from '../../../../shared/ui/markdown/MarkdownHast'
import {
  sliceSourceParts,
  type MarkdownSourcePart
} from '../../../../shared/ui/markdown/sourceParts'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'
import { useMarkdownRows, type MarkdownRow } from './useMarkdownRows'

const ParsedTableRows = memo(function ParsedTableRows({
  tree,
  source,
  parts,
  onComplete
}: {
  tree: Root
  source: string
  parts?: readonly MarkdownSourcePart[]
  onComplete?: () => void
}): React.JSX.Element {
  const rows = useMemo((): Root => {
    const table = tree.children.find(
      (node): node is Element => node.type === 'element' && node.tagName === 'table'
    )
    const body = table?.children.find(
      (node): node is Element => node.type === 'element' && node.tagName === 'tbody'
    )
    return {
      type: 'root',
      children: body?.children.filter((child) => child.type !== 'text' || child.value.trim()) ?? []
    }
  }, [tree])
  return <MarkdownHast hast={rows} source={source} parts={parts} onComplete={onComplete} />
})

export function ParsedMarkdownBlock({
  roots,
  source,
  parts,
  onComplete
}: {
  roots: Root[]
  source: string
  parts?: readonly MarkdownSourcePart[]
  onComplete?: () => void
}): React.JSX.Element {
  return (
    <MarkdownHast
      hast={roots[0]}
      source={source}
      parts={parts}
      onComplete={roots.length === 1 ? onComplete : undefined}
      tableRows={roots.slice(1).map((tree, i) => (
        <ParsedTableRows
          key={i}
          tree={tree}
          source={source}
          parts={parts}
          onComplete={i === roots.length - 2 ? onComplete : undefined}
        />
      ))}
    />
  )
}

export const MarkdownRowView = memo(function MarkdownRowView({
  row,
  priority,
  parts,
  onComplete,
  showPendingText = false
}: {
  row: MarkdownRow
  priority: Priority
  showPendingText?: boolean
  parts?: readonly MarkdownSourcePart[]
  onComplete?: () => void
}): React.JSX.Element {
  const { doc, segment, block } = row
  const [result, setResult] = useState<{ row: MarkdownRow; roots: Root[] | null }>()
  const roots = result?.row === row ? result.roots : undefined
  const failed = roots === null
  const count = roots?.length ?? 0
  const chunks = block.table?.length ?? 1
  const [painted, setPainted] = useState<{ row: MarkdownRow; count: number }>()
  const committed = painted?.row === row ? painted.count : 0
  const afterPaint = useMemo(() => () => setPainted({ row, count }), [row, count])
  const task = useRef<ComputeHandle<ComputeResults['markdown']> | null>(null)
  const rank = useRef(priority)
  useEffect(() => {
    rank.current = priority
    task.current?.setPriority(priority)
  }, [priority])
  useEffect(() => {
    if (failed || count >= chunks || committed < count) return
    const client = computeClient()
    // A completed segment releases capacity even if its rendered blocks remain mounted.
    const lease = client.openDocument(doc, { text: segment.text, lines: undefined }, 'markdown')
    let active = true
    const start = (): void => {
      const table = block.table?.[count]
      const handle = client.request<'markdown'>(
        { kind: 'markdown', doc, start: block.start, end: block.end, ...(table && { table }) },
        { priority: rank.current }
      )
      task.current = handle
      void handle.promise.then(
        (value) => {
          if (active)
            setResult((previous) => ({
              row,
              roots: [...(previous?.row === row ? (previous.roots ?? []) : []), value.hast]
            }))
        },
        () => {
          if (active) setResult({ row, roots: null })
        }
      )
    }
    const unsubscribe = lease.available ? (start(), undefined) : lease.onAvailable(start)
    return () => {
      active = false
      unsubscribe?.()
      task.current?.cancel()
      task.current = null
      lease.release()
    }
  }, [row, doc, block, segment, failed, count, chunks, committed])
  const text = segment.text.slice(block.start, block.end)
  const localParts = useMemo(
    () => sliceSourceParts(parts, segment.start + block.start, segment.start + block.end),
    [parts, segment, block]
  )
  useEffect(() => {
    if (failed || committed === chunks) onComplete?.()
  }, [failed, committed, chunks, onComplete])
  if (!roots?.length)
    return (
      <pre
        data-md-block-error={failed ? '' : undefined}
        data-md-block-pending={failed ? undefined : ''}
        className="whitespace-pre-wrap break-words"
      >
        {failed || showPendingText ? text : ''}
      </pre>
    )
  return (
    <>
      <ParsedMarkdownBlock roots={roots} source={text} parts={localParts} onComplete={afterPaint} />
      {committed < chunks && <span hidden data-md-block-pending="" />}
    </>
  )
})

function WorkerDocument({ source, sourceParts, className }: MarkdownProps): React.JSX.Element {
  const id = useId()
  const rows = useMarkdownRows(source, id)
  const [progress, setProgress] = useState({ rows, count: 1 })
  const count = progress.rows === rows ? progress.count : 1
  const active = rows?.[count - 1]
  const doc = active?.doc
  const segment = active?.segment
  useEffect(() => {
    if (!doc || !segment) return
    const lease = computeClient().openDocument(doc, { text: segment.text }, 'markdown')
    return () => lease.release()
  }, [doc, segment])
  const advance = useMemo(
    () => () => {
      setProgress({ rows, count: count + 1 })
    },
    [rows, count]
  )
  if (!rows) return <span data-md-block-pending="" />
  if (!rows.length)
    return (
      <pre data-md-block-error="" className="whitespace-pre-wrap break-words">
        {source}
      </pre>
    )
  return (
    <div
      className={
        (className ?? MARKDOWN_TYPOGRAPHY + ' text-ink') +
        ' [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_1lh]'
      }
      data-md-block-pending={count < rows.length ? '' : undefined}
    >
      {rows.slice(0, count).map((row, i) => (
        <MarkdownRowView
          key={i}
          row={row}
          priority="visible"
          parts={sourceParts}
          onComplete={i === count - 1 ? advance : undefined}
        />
      ))}
    </div>
  )
}

export function TranscriptMarkdown(props: MarkdownProps): React.JSX.Element {
  return props.source.length > MARKDOWN_WORKER_MIN_CHARS ? (
    <WorkerDocument {...props} />
  ) : (
    <Markdown {...props} />
  )
}
