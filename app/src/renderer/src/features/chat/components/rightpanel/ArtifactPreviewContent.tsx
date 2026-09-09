import { useState } from 'react'
import type { ArtifactPreviewResult } from '../../../../../../shared/artifacts'
import { Markdown } from '../../../../shared/ui/markdown/Markdown'
import { CodeBlock } from '../../../../shared/ui/markdown/CodeBlock'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { retryArtifactViewer } from '../../store/artifactViewerStore'

type ReadyPreview = Extract<ArtifactPreviewResult, { state: 'ready' }>

function HtmlPreview({ content, title }: { content?: string; title: string }): React.JSX.Element {
  const { tr } = useI18n()
  // Only Main's sanitized full document enters a browsing context. Never fall back
  // to raw HTML when it is absent: that original remains available in code mode.
  if (content === undefined)
    return (
      <p role="alert" className="p-6 text-footnote text-ink2">
        {tr('chat.artifactViewer.unsupported')}
      </p>
    )
  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={content}
      className="h-full min-h-0 w-full border-0 bg-[Canvas] [color-scheme:light]"
    />
  )
}

function ImagePreview({ content, title }: { content: string; title: string }): React.JSX.Element {
  const { tr } = useI18n()
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      {failed ? (
        <div className="flex flex-col items-center gap-3">
          <p role="alert" className="text-footnote text-ink2">
            {tr('chat.artifactViewer.imageFailed')}
          </p>
          <Button
            size="small"
            data-behavior="viewer:retry"
            onClick={() => void retryArtifactViewer()}
          >
            {tr('chat.artifactViewer.retry')}
          </Button>
        </div>
      ) : (
        <img
          src={content}
          alt={title}
          onError={() => setFailed(true)}
          className="h-auto max-h-full max-w-full object-contain"
        />
      )}
    </div>
  )
}

export function ArtifactPreviewContent({
  result,
  mode,
  title
}: {
  result: ReadyPreview
  mode: 'preview' | 'code'
  title: string
}): React.JSX.Element {
  const { tr } = useI18n()
  if (result.format === 'image') return <ImagePreview content={result.content} title={title} />
  if (!result.content)
    return <p className="p-6 text-footnote text-ink3">{tr('chat.artifactViewer.empty')}</p>
  if (mode === 'code' || result.format === 'text')
    return (
      <CodeBlock
        code={result.content}
        lang={
          result.language ??
          (result.format === 'markdown' ? 'markdown' : result.format === 'html' ? 'html' : 'text')
        }
        embedded
        showHeader={false}
        showLineNumbers
      />
    )
  if (result.format === 'html') return <HtmlPreview content={result.previewContent} title={title} />
  return (
    <div className="mx-auto max-w-3xl px-7 py-6">
      <Markdown source={result.content} />
    </div>
  )
}
