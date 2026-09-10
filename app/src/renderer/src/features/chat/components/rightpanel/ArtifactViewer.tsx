import { useEffect, useRef } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { PanelCloseButton, PanelExpandButton } from '../../../../shared/ui/PanelControls'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { previewFailureKey } from '../../lib/artifactFeedback'
import { useArtifactViewerActions } from '../../hooks/useArtifactViewerActions'
import { ArtifactPreviewContent } from './ArtifactPreviewContent'
import {
  closeArtifactViewer,
  retryArtifactViewer,
  setArtifactViewerMode,
  toggleArtifactViewerExpanded,
  type ArtifactViewerSelection
} from '../../store/artifactViewerStore'

export function ArtifactViewer({
  selection
}: {
  selection: ArtifactViewerSelection
}): React.JSX.Element {
  const { tr } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { action, feedback, copy, download } = useArtifactViewerActions(selection)
  const { artifact, result, loading, mode, expanded } = selection
  const ready = result?.state === 'ready' ? result : null
  const image = ready?.format === 'image' || artifact.kind === 'image'
  const binary = artifact.kind === 'file'
  const textOnly = ready?.format === 'text' || artifact.kind === 'text'
  const unsupported = result?.state === 'unavailable' && result.reason === 'unsupported-format'
  const downloadable = !!ready || unsupported
  const extension = artifact.filename.split('.').pop()?.toUpperCase() ?? ''
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])
  return (
    <section
      data-artifact-viewer={artifact.publicationId}
      aria-label={tr('chat.artifactViewer.title')}
      className="app-frame-tile effect-primary-elevated flex h-full min-h-0 flex-col overflow-hidden rounded-r6 border border-border bg-panel"
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
          <PanelExpandButton
            expanded={expanded}
            data-behavior="viewer:expand"
            onClick={toggleArtifactViewerExpanded}
          />
          <PanelCloseButton
            ref={closeRef}
            label={tr('chat.artifactViewer.close')}
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
