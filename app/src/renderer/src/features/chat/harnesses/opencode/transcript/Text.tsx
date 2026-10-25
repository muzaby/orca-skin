import { transcriptTypography } from '../../common/transcript/typography'
import { memo } from 'react'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { StreamingMarkdown } from '../../../components/markdown/StreamingMarkdown'

// Typography comes from the shared Markdown renderer; only the palette differs.
const proseColours =
  '[&_strong]:text-oc-ink [&_a]:text-oc-accent [&_:not(pre)>code]:border-oc-layer-2 [&_:not(pre)>code]:bg-oc-layer-2 [&_:not(pre)>code]:text-oc-ink [&_h1]:text-oc-ink [&_h2]:text-oc-ink [&_h3]:text-oc-ink [&_h4]:text-oc-ink [&_h5]:text-oc-ink [&_h6]:text-oc-muted [&_blockquote]:border-oc-border [&_blockquote]:text-oc-muted'

export const OpenCodeText = memo(function OpenCodeText({
  source,
  streaming = false
}: {
  source: string
  streaming?: boolean
}): React.JSX.Element {
  return (
    <div data-component="opencode-text" className={`min-w-0 text-oc-ink ${proseColours}`}>
      {streaming ? (
        <StreamingMarkdown
          source={source}
          className={`${transcriptTypography.prose} text-oc-ink`}
        />
      ) : (
        <Markdown source={source} className={`${transcriptTypography.prose} text-oc-ink`} />
      )}
    </div>
  )
})
