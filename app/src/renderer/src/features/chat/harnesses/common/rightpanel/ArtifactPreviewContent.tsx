import { VirtualMarkdownView } from '../../../components/markdown/VirtualMarkdownView'
import { MARKDOWN_WORKER_MIN_CHARS } from '../../../../../shared/compute/limits'
import { VirtualCodeView } from '../../../components/code/VirtualCodeView'
import { countLinesUpTo } from '../../../../../shared/compute/diffModel'
import { VIRTUAL_BODY_MIN_LINES } from '../../../../../shared/ui/virtual/limits'
import { useState, useMemo, type RefObject } from 'react'
import type { ArtifactPreviewResult } from '../../../../../../../shared/artifacts'
import { Markdown } from '../../../../../shared/ui/markdown/Markdown'
import { CodeBlock } from '../../../../../shared/ui/markdown/CodeBlock'
import { useI18n } from '../../../../../shared/i18n'
import { Button } from '../../../../../shared/ui/Button'
import { retryArtifactViewer } from '../../../store/artifactViewerStore'

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
  publicationId,
  mode,
  title,
  scrollElement
}: {
  publicationId?: string
  scrollElement?: RefObject<HTMLDivElement | null>
  result: ReadyPreview
  mode: 'preview' | 'code'
  title: string
}): React.JSX.Element {
  const { tr } = useI18n()
  const isCode = mode === 'code' || result.format === 'text'
  const large = useMemo(
    () => isCode && countLinesUpTo(result.content, VIRTUAL_BODY_MIN_LINES) > VIRTUAL_BODY_MIN_LINES,
    [isCode, result.content]
  )
  if (result.format === 'image') return <ImagePreview content={result.content} title={title} />
  if (!result.content)
    return <p className="p-6 text-footnote text-ink3">{tr('chat.artifactViewer.empty')}</p>
  if (isCode) {
    const lang =
      result.language ??
      (result.format === 'markdown' ? 'markdown' : result.format === 'html' ? 'html' : 'text')
    if (large)
      return (
        <VirtualCodeView
          revisionSource={result}
          documentId={publicationId ? 'code:artifact:' + publicationId : undefined}
          code={result.content}
          lang={lang}
          showLineNumbers
          scrollElement={scrollElement}
        />
      )
    return (
      <CodeBlock code={result.content} lang={lang} embedded showHeader={false} showLineNumbers />
    )
  }
  if (result.format === 'html') return <HtmlPreview content={result.previewContent} title={title} />
  return (
    <div className="mx-auto max-w-3xl px-7 py-6">
      {result.content.length > MARKDOWN_WORKER_MIN_CHARS ? (
        <VirtualMarkdownView
          revisionSource={result}
          documentId={publicationId ? 'md:' + publicationId : undefined}
          source={result.content}
          scrollElement={scrollElement}
        />
      ) : (
        <Markdown source={result.content} />
      )}
    </div>
  )
}
