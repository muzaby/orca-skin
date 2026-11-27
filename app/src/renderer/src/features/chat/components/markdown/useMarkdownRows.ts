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

export interface MarkdownRow {
  block: DocumentBlock
  segment: MarkdownSegment
  doc: { id: string; revision: number }
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
    return markdownSegments(
      source,
      hydrated?.layout ?? (needsWorker ? indexed?.layout : undefined),
      hydrated?.pieces
    ).flatMap((segment, i) => {
      const doc = { id: i ? id + ':' + segment.start : id, revision }
      return segment.blocks.map((block) => ({ doc, block, segment }))
    })
  }, [source, id, revisionSource, needsWorker, indexed, hydrated])
}
