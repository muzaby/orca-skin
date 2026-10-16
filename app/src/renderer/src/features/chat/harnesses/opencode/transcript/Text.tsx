import { memo } from 'react'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { StreamingMarkdown } from '../../../components/markdown/StreamingMarkdown'

// Scoped to assistant prose: shared Markdown and Claude keep their own typography.
const prose = [
  'text-inherit leading-[inherit] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[&_p]:mt-0 [&_p]:mb-[12px] [&_strong]:font-normal [&_strong]:text-oc-ink',
  '[&_a]:text-oc-accent [&_a]:no-underline [&_a:hover]:underline',
  '[&_:not(pre)>code]:border-0 [&_:not(pre)>code]:bg-oc-layer-2 [&_:not(pre)>code]:text-oc-ink [&_:not(pre)>code]:py-0 [&_:not(pre)>code]:text-[calc(13px*var(--transcript-text-scale,1))]',
  '[&_h1]:mt-[28px] [&_h1]:mb-[12px] [&_h1]:text-[calc(17px*var(--transcript-text-scale,1))]',
  '[&_h2]:mt-[24px] [&_h2]:mb-[10px] [&_h2]:text-[calc(15px*var(--transcript-text-scale,1))]',
  '[&_h3]:mt-[20px] [&_h3]:mb-[8px] [&_h3]:text-[calc(13px*var(--transcript-text-scale,1))]',
  '[&_ul]:mt-[8px] [&_ul]:mb-[12px] [&_ul]:pl-[32px] [&_ol]:mt-[8px] [&_ol]:mb-[12px] [&_ol]:pl-[32px] [&_li]:mb-[8px]',
  '[&_blockquote]:my-[16px] [&_blockquote]:border-l-[0.5px] [&_blockquote]:border-oc-border [&_blockquote]:pl-[8px] [&_blockquote]:text-oc-muted',
  '[&_hr]:my-[32px] [&_hr]:border-0'
].join(' ')

export const OpenCodeText = memo(function OpenCodeText({
  source,
  streaming = false
}: {
  source: string
  streaming?: boolean
}): React.JSX.Element {
  return (
    <div
      data-component="opencode-text"
      className="min-w-0 text-[calc(14px*var(--transcript-text-scale,1))] font-[440] leading-[1.6] text-oc-ink"
    >
      {streaming ? (
        <StreamingMarkdown source={source} className={prose} />
      ) : (
        <Markdown source={source} className={prose} />
      )}
    </div>
  )
})
