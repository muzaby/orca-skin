import { memo } from 'react'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { StreamingMarkdown } from '../../../components/markdown/StreamingMarkdown'
import { useI18n } from '../../../../../shared/i18n'
import type { ReasoningItem } from '../../../lib/parts'

const prose =
  'text-inherit leading-[inherit] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-oc-accent [&_a]:underline [&_code]:border-oc-border [&_code]:bg-oc-layer-2 [&_code]:text-oc-accent'

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
export const OpenCodeReasoning = memo(function OpenCodeReasoning({
  items,
  streaming = false
}: {
  items: ReasoningItem[]
  streaming?: boolean
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const source = items.map((item) => item.text).join('\n\n')
  if (!source.trim()) return null
  return (
    <div
      data-component="opencode-reasoning"
      aria-label={tr('chat.transcript.reasoning')}
      className="min-w-0 text-[calc(13px*var(--transcript-text-scale,1))] font-[440] leading-[20px] text-oc-muted [&_p]:text-oc-muted [&_strong]:text-oc-muted"
    >
      {streaming ? (
        <StreamingMarkdown source={source} className={prose} />
      ) : (
        <Markdown source={source} className={prose} />
      )}
    </div>
  )
})
