import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import type { Element, Root } from 'hast'
import { MarkdownHast } from '../../../../shared/ui/markdown/MarkdownHast'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'
import { computeClient, type ComputeHandle, type Priority } from '../../../../shared/compute/client'
import type { ComputeResults, DocRef } from '../../../../shared/compute/protocol'
import { useComputeDocument } from '../../../../shared/compute/useComputeDocument'
import { useVirtualRows } from '../../../../shared/ui/virtual/useVirtualRows'
import { markdownDocumentBlocks, type DocumentBlock } from '../../lib/markdownDocumentBlocks'

function mergeTableChunks(roots: Root[]): Root {
  const root = roots[0]
  if (roots.length === 1) return root
  const table = (r: Root): Element | undefined =>
    r.children.find((n): n is Element => n.type === 'element' && n.tagName === 'table')
  const first = table(root)
  if (!first) return root
  const body = (t: Element): Element | undefined =>
    t.children.find((n): n is Element => n.type === 'element' && n.tagName === 'tbody')
  const firstBody = body(first)
  if (!firstBody) return root
  const merged = {
    ...firstBody,
    children: roots.flatMap((r) => {
      const t = table(r)
      return (t && body(t)?.children) || []
    })
  }
  return {
    ...root,
    children: root.children.map((n) =>
      n === first
        ? { ...first, children: first.children.map((c) => (c === firstBody ? merged : c)) }
        : n
    )
  }
}
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
    hast: Root | null
  } | null>(null)
  const tasks = useRef<ComputeHandle<ComputeResults['markdown']>[]>([])
  const rank = useRef(priority)
  useEffect(() => {
    rank.current = priority
    for (const task of tasks.current) task.setPriority(priority)
  }, [priority])
  useEffect(() => {
    if (!ready || block.raw) return
    let active = true
    const handles = (block.table ?? [undefined]).map((table) =>
      computeClient().request<'markdown'>(
        { kind: 'markdown', doc, start: block.start, end: block.end, ...(table && { table }) },
        { priority: rank.current }
      )
    )
    tasks.current = handles
    const stop = (): void => {
      active = false
      for (const h of handles) h.cancel()
      tasks.current = []
    }
    void Promise.all(
      handles.map((h) =>
        h.promise.then((r) => {
          if ('tooLarge' in r) throw Error('too-large')
          return r.hast
        })
      )
    ).then(
      (roots) => {
        if (active) setResult({ block, doc, hast: mergeTableChunks(roots) })
      },
      () => {
        if (active) {
          stop()
          setResult({ block, doc, hast: null })
        }
      }
    )
    return stop
  }, [ready, block, doc])
  const text = source.slice(block.start, block.end)
  const value = result?.doc === doc && result.block === block ? result.hast : undefined
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
  scrollElement
}: {
  source: string
  scrollElement?: RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const own = useRef<HTMLDivElement>(null),
    root = useRef<HTMLDivElement>(null)
  const { ref, ready } = useComputeDocument(useId(), source, 'markdown')
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
