import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { artifactApi } from '../../../../shared/api/ipc'
import { artifactFailureKey } from '../ArtifactCard'
import { ArtifactPreviewContent } from './ArtifactPreviewContent'
import {
  closeArtifactViewer,
  retryArtifactViewer,
  setArtifactViewerMode,
  toggleArtifactViewerExpanded,
  useArtifactViewerStore,
  type ArtifactViewerSelection
} from '../../store/artifactViewerStore'

function previewFailureKey(reason: string): MessageKey {
  if (reason === 'unsupported-format') return 'chat.artifactViewer.unsupported'
  if (reason === 'invalid-utf8' || reason === 'invalid-encoding')
    return 'chat.artifactViewer.invalidEncoding'
  return artifactFailureKey(reason)
}

export function ArtifactViewer({
  selection
}: {
  selection: ArtifactViewerSelection
}): React.JSX.Element {
  const { tr } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [action, setAction] = useState<'copy' | 'download' | null>(null)
  const actionRef = useRef(false)
  const [feedback, setFeedback] = useState<MessageKey | null>(null)
  const alive = useRef(true)
  const { artifact, result, loading, mode, expanded } = selection
  const ready = result?.state === 'ready' ? result : null
  const image = ready?.format === 'image' || artifact.kind === 'image'
  const binary = artifact.kind === 'file'
  const textOnly = ready?.format === 'text' || artifact.kind === 'text'
  const unsupported = result?.state === 'unavailable' && result.reason === 'unsupported-format'
  const downloadable = !!ready || unsupported
  const extension = artifact.filename.split('.').pop()?.toUpperCase() ?? ''
  const current = (): boolean =>
    alive.current && useArtifactViewerStore.getState().selection?.request === selection.request
  useEffect(() => {
    alive.current = true
    closeRef.current?.focus({ preventScroll: true })
    return () => {
      alive.current = false
    }
  }, [])
  const copy = async (): Promise<void> => {
    if (!ready || image || actionRef.current) return
    actionRef.current = true
    setAction('copy')
    setFeedback(null)
    try {
      await navigator.clipboard.writeText(ready.content)
      if (current()) setFeedback('chat.artifactViewer.copied')
    } catch {
      if (current()) setFeedback('chat.artifactViewer.copyFailed')
    } finally {
      actionRef.current = false
      if (current()) setAction(null)
    }
  }
  const download = async (): Promise<void> => {
    if (!downloadable || actionRef.current) return
    actionRef.current = true
    setAction('download')
    setFeedback(null)
    try {
      const saved = await artifactApi.save({
        sessionId: selection.sessionId,
        publicationIds: [artifact.publicationId]
      })
      if (current())
        setFeedback(
          saved.outcome === 'cancelled'
            ? 'chat.artifacts.cancelled'
            : saved.outcome === 'completed' && saved.items[0]?.outcome === 'saved'
              ? 'chat.artifacts.saved'
              : artifactFailureKey(saved.reason ?? saved.items[0]?.reason)
        )
    } catch {
      if (current()) setFeedback('chat.artifacts.failed')
    } finally {
      actionRef.current = false
      if (current()) setAction(null)
    }
  }
  return (
    <section
      data-artifact-viewer={artifact.publicationId}
      aria-label={tr('chat.artifactViewer.title')}
      className="app-frame-tile effect-primary-elevated ml-2 flex h-full min-h-0 flex-col overflow-hidden rounded-r6 border border-border bg-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          closeArtifactViewer(selection.sessionKey)
        }
      }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border px-2 py-2">
        <div
          role="radiogroup"
          aria-label={tr('chat.artifactViewer.mode')}
          className="flex shrink-0 rounded-r4 border border-border bg-bg2 p-0.5"
          onKeyDown={(event) => {
            if (!image && !textOnly && !binary && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault()
              setArtifactViewerMode(mode === 'preview' ? 'code' : 'preview')
              const buttons =
                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')
              buttons[mode === 'preview' ? 1 : 0]?.focus()
            }
          }}
        >
          {(['preview', 'code'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              aria-label={tr(`chat.artifactViewer.${value}`)}
              title={tr(`chat.artifactViewer.${value}`)}
              tabIndex={mode === value ? 0 : -1}
              disabled={binary || (value === 'preview' ? textOnly : image)}
              onClick={() => setArtifactViewerMode(value)}
              className={`flex h-6 w-7 items-center justify-center rounded-sm text-ink3 transition-colors hide-focus-ring ring-focus disabled:opacity-30 ${mode === value ? 'bg-panel text-ink shadow-sm' : 'hover:text-ink'}`}
            >
              <Icon name={value === 'preview' ? 'eye' : 'code'} size={16} />
            </button>
          ))}
        </div>
        <h2
          className="min-w-0 flex-1 truncate text-footnote font-normal text-ink2"
          title={artifact.filename}
        >
          {artifact.title}
          <span className="px-1.5 text-ink3">·</span>
          <span className="text-ink3">{extension}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          {!image && !binary && (
            <Button
              iconOnly
              size="small"
              leadingIcon={feedback === 'chat.artifactViewer.copied' ? 'check' : 'copy'}
              disabled={!ready || !!action}
              aria-label={tr('chat.artifactViewer.copy')}
              title={tr('chat.artifactViewer.copy')}
              data-behavior="viewer:copy"
              onClick={() => void copy()}
            />
          )}
          <Button
            size="small"
            variant="contained"
            leadingIcon="download"
            disabled={!downloadable || !!action}
            aria-label={tr('chat.artifacts.download')}
            title={tr('chat.artifacts.download')}
            data-behavior="viewer:download"
            onClick={() => void download()}
          >
            {tr('chat.artifacts.download')}
          </Button>
          <Button
            iconOnly
            size="small"
            leadingIcon={expanded ? 'collapse' : 'expand'}
            aria-expanded={expanded}
            aria-label={tr(expanded ? 'chat.artifactViewer.restore' : 'chat.artifactViewer.expand')}
            title={tr(expanded ? 'chat.artifactViewer.restore' : 'chat.artifactViewer.expand')}
            data-behavior="viewer:expand"
            onClick={toggleArtifactViewerExpanded}
          />
          <Button
            ref={closeRef}
            iconOnly
            size="small"
            leadingIcon="x"
            aria-label={tr('chat.artifactViewer.close')}
            title={tr('chat.artifactViewer.close')}
            data-behavior="viewer:close"
            onClick={() => closeArtifactViewer(selection.sessionKey)}
          />
        </div>
      </div>
      {(feedback || action) && (
        <p
          role="status"
          className="shrink-0 border-b border-border px-3 py-1.5 text-caption text-ink2"
        >
          {tr(
            action === 'copy'
              ? 'chat.artifactViewer.copyBusy'
              : action === 'download'
                ? 'chat.artifactViewer.downloadBusy'
                : feedback!
          )}
        </p>
      )}
      <div
        data-artifact-viewer-body=""
        className={`min-h-0 flex-1 ${ready?.format === 'html' && mode === 'preview' ? 'overflow-hidden' : 'overflow-auto'}`}
      >
        {loading ? (
          <div
            role="status"
            className="flex h-full items-center justify-center gap-2 p-6 text-footnote text-ink3"
          >
            <Icon name="doc" size={18} />
            {tr('chat.artifactViewer.loading')}
          </div>
        ) : result?.state === 'unavailable' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-7 py-8 text-center">
            <Icon name="doc" size={32} className="text-ink3" />
            <p role="alert" className="text-footnote text-ink2">
              {tr(previewFailureKey(result.reason))}
            </p>
            {!unsupported && (
              <Button
                size="small"
                leadingIcon="refresh"
                data-behavior="viewer:retry"
                onClick={() => void retryArtifactViewer()}
              >
                {tr('chat.artifactViewer.retry')}
              </Button>
            )}
          </div>
        ) : (
          ready && (
            <ArtifactPreviewContent
              key={`${artifact.publicationId}:${selection.request}`}
              result={ready}
              mode={mode}
              title={artifact.title}
            />
          )
        )}
      </div>
    </section>
  )
}
