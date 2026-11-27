import { useId, useRef, type RefObject } from 'react'
import { MarkdownRowView } from './MarkdownDocument'
import { useMarkdownRows } from './useMarkdownRows'
import { MARKDOWN_TYPOGRAPHY } from '../../../../shared/ui/markdown/typography'
import { useVirtualRows } from '../../../../shared/ui/virtual/useVirtualRows'

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
  const rows = useMarkdownRows(source, documentId ?? fallbackId, revisionSource)
  const list = useVirtualRows(rows?.length ?? 0, root, scrollElement ?? own)
  if (!rows) return <span data-md-block-pending="" />
  if (!rows.length)
    return (
      <pre data-md-block-error="" className="whitespace-pre-wrap break-words">
        {source}
      </pre>
    )
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
            <MarkdownRowView
              row={rows[item.index]}
              showPendingText
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
