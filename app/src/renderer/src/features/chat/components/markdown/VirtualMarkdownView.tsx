import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { mergeTableChunks } from './mergeTableChunks'
import type { Root } from 'hast'
import { MarkdownHast } from '../../../../shared/ui/markdown/MarkdownHast'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'
import { computeClient, type ComputeHandle, type Priority } from '../../../../shared/compute/client'
import type { ComputeResults, DocRef } from '../../../../shared/compute/protocol'
import { useComputeDocument } from '../../../../shared/compute/useComputeDocument'
import { useVirtualRows } from '../../../../shared/ui/virtual/useVirtualRows'
import { markdownDocumentBlocks, type DocumentBlock } from '../../lib/markdownDocumentBlocks'

function Block({
  doc,
  block,
  source,
  ready,
  priority
}: {
  doc: DocRef
  block: DocumentBlock
  source: string
  ready: boolean
  priority: Priority
}): React.JSX.Element {
  const [result, setResult] = useState<{
    block: DocumentBlock
    doc: DocRef
    roots: Root[] | null
  } | null>(null)
  const roots = result?.doc === doc && result.block === block ? result.roots : undefined
  const count = roots?.length ?? 0
  const failed = roots === null
  const task = useRef<ComputeHandle<ComputeResults['markdown']> | null>(null)
  const rank = useRef(priority)
  useEffect(() => {
    rank.current = priority
    task.current?.setPriority(priority)
  }, [priority])
  // Each committed chunk unlocks the next one, bounding new DOM per worker result.
  useEffect(() => {
    if (!ready || block.raw || failed || count >= (block.table?.length ?? 1)) return
    const table = block.table?.[count]
    const handle = computeClient().request<'markdown'>(
      { kind: 'markdown', doc, start: block.start, end: block.end, ...(table && { table }) },
      { priority: rank.current }
    )
    task.current = handle
    let active = true
    const fallback = (): void => {
      if (active) setResult({ block, doc, roots: null })
    }
    void handle.promise.then((value) => {
      if (!active) return
      if ('tooLarge' in value) {
        fallback()
        return
      }
      setResult((old) => ({
        block,
        doc,
        roots: [...(old?.block === block && old.doc === doc ? (old.roots ?? []) : []), value.hast]
      }))
    }, fallback)
    return () => {
      active = false
      task.current = null
      handle.cancel()
    }
  }, [block, doc, ready, failed, count])
  const text = source.slice(block.start, block.end)
  const value = useMemo(() => (roots ? mergeTableChunks(roots) : roots), [roots])
  if (!value)
    return (
      <pre
        data-md-block-raw={block.raw || value === null ? '' : undefined}
        data-md-block-pending={!block.raw && value === undefined ? '' : undefined}
        className="whitespace-pre-wrap break-words"
      >
        {text}
      </pre>
    )
  return <MarkdownHast hast={value} source={text} />
}
export function VirtualMarkdownView({
  source,
  documentId,
  revisionSource,
  scrollElement
}: {
  source: string
  documentId?: string
  revisionSource?: object
  scrollElement?: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const own = useRef<HTMLDivElement>(null),
    root = useRef<HTMLDivElement>(null)
  const fallbackId = useId()
  const { ref, ready } = useComputeDocument(
    documentId ?? fallbackId,
    source,
    'markdown',
    revisionSource
  )
  const blocks = useMemo(() => markdownDocumentBlocks(source), [source])
  const list = useVirtualRows(blocks.length, root, scrollElement ?? own)
  return (
    <div ref={own} className={scrollElement ? undefined : 'h-full overflow-auto'}>
      <div
        ref={root}
        className={MARKDOWN_TYPOGRAPHY + ' relative text-ink'}
        style={{ height: list.getTotalSize() }}
      >
        {list.getVirtualItems().map((item) => (
          <div
            ref={list.measureElement}
            key={item.index}
            data-index={item.index}
            className="absolute top-0 w-full"
            style={{ transform: `translateY(${item.start - list.options.scrollMargin}px)` }}
          >
            <Block
              doc={ref}
              block={blocks[item.index]}
              source={source}
              ready={ready}
              priority={
                list.range &&
                item.index >= list.range.startIndex &&
                item.index <= list.range.endIndex
                  ? 'visible'
                  : 'background'
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}
