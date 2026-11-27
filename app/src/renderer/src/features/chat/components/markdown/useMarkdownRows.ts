import { useEffect, useMemo, useState } from 'react'
import { computeClient } from '../../../../shared/compute/client'
import { findHistoryLayout } from '../../../../shared/markdown/historyLayout'
import { revisionOf } from '../../../../shared/compute/documents'
import {
  markdownSegments,
  type MarkdownSegment,
  type MarkdownSegmentRange
} from '../../../../shared/markdown/markdownSegments'
import type { DocumentBlock } from '../../../../shared/markdown/markdownDocumentBlocks'

export interface SourceRow {
  block: DocumentBlock
  segment: MarkdownSegment
  doc: { id: string; revision: number }
}
export interface MarkdownRow extends SourceRow {
  fencePieces?: SourceRow[]
  readSource?: (start: number, end: number) => string
}
let layoutSequence = 0
// Indexing a multi-megabyte source scans every line. The worker returns only offsets
// so the renderer can lease individual segments without cloning the indexed text back.
export function useMarkdownRows(
  source: string,
  id: string,
  revisionSource?: object
): MarkdownRow[] | undefined {
  const hydrated = useMemo(
    () => (source.length > 65536 ? findHistoryLayout(source) : undefined),
    [source]
  )
  const needsWorker = source.length > 65536 && !hydrated
  const [indexed, setIndexed] = useState<{ source: string; layout: MarkdownSegmentRange[] }>()
  useEffect(() => {
    if (!needsWorker) return
    const job = computeClient().request<'markdownLayout'>(
      { kind: 'markdownLayout', sequence: ++layoutSequence, source },
      { cacheable: false }
    )
    let active = true
    void job.promise.then(
      ({ segments }) => {
        if (active) setIndexed({ source, layout: segments })
      },
      () => {
        if (active) setIndexed({ source, layout: [] })
      }
    )
    return () => {
      active = false
      job.cancel()
    }
  }, [source, needsWorker])
  return useMemo(() => {
    if (needsWorker && indexed?.source !== source) return undefined
    const revision = revisionOf(revisionSource ?? {})
    const segments = markdownSegments(
      source,
      hydrated?.layout ?? (needsWorker ? indexed?.layout : undefined),
      hydrated?.pieces
    )
    const rows: MarkdownRow[] = []
    segments.forEach((segment, i) => {
      const doc = { id: i ? id + ':' + segment.start : id, revision }
      for (const block of segment.blocks) {
        const piece = { doc, block, segment }
        if (!block.fence) rows.push(piece)
        else {
          const last = rows.at(-1)
          if (last?.fencePieces && last.block.fence?.start === block.fence.start)
            last.fencePieces.push(piece)
          else
            rows.push({
              ...piece,
              fencePieces: [piece],
              readSource: (a, b) => hydrated?.pieces?.slice(a, b) ?? source.slice(a, b)
            })
        }
      }
    })
    return rows
  }, [source, id, revisionSource, needsWorker, indexed, hydrated])
}
