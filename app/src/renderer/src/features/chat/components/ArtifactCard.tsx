import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { useI18n, type MessageKey } from '../../../shared/i18n'
import { useChatSession, useChatStore } from '../store/chatStore'
import { openArtifactViewer } from '../store/artifactViewerStore'
import {
  acquireArtifacts,
  refreshArtifactStatuses,
  runArtifactAction,
  useArtifactStore,
  type ArtifactFileView,
  type ArtifactOperation,
  type ArtifactOperationResult
} from '../store/artifactStore'
import { artifactOperationIssues } from '../lib/artifactOperationIssues'

const EMPTY_FILES: Record<string, ArtifactFileView> = {}

// eslint-disable-next-line react-refresh/only-export-components -- 카드의 고정 오류 번역 계약을 직접 시험한다.
export function artifactFailureKey(reason?: string): MessageKey {
  switch (reason) {
    case 'missing':
    case 'not-found':
      return 'chat.artifacts.missing'
    case 'access-denied':
      return 'chat.artifacts.unavailable'
    case 'forbidden':
      return 'chat.artifacts.forbidden'
    case 'unsafe-path':
      return 'chat.artifacts.unsafe'
    case 'too-large':
      return 'chat.artifacts.tooLarge'
    case 'too-many-items':
      return 'chat.artifacts.tooMany'
    case 'busy':
      return 'chat.artifacts.working'
    default:
      return 'chat.artifacts.failed'
  }
}

interface ArtifactCardProps {
  artifact: ArtifactRef
  variant?: 'transcript' | 'list'
  file?: ArtifactFileView
  onAction: (artifact: ArtifactRef, action: ArtifactOperation) => void
  onRefresh: () => void
  onPreview: (artifact: ArtifactRef, origin: HTMLElement) => void
}

export function ArtifactCard({
  artifact,
  variant = 'transcript',
  file,
  onAction,
  onRefresh,
  onPreview
}: ArtifactCardProps): React.JSX.Element {
  const { tr } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const checking = !file?.availability || file.checking
  const present = file?.availability?.state === 'present'
  const disabled = checking || file?.busy
  const transcript = variant === 'transcript'
  const dot = artifact.filename.lastIndexOf('.')
  const format = dot > 0 ? artifact.filename.slice(dot + 1).toUpperCase() : ''
  const ordinaryFile = artifact.category === 'file'
  const metadata = `${artifact.filename} · ${tr('chat.artifacts.bytes', { count: artifact.sizeBytes })} · ${new Date(artifact.publishedAt).toLocaleString()}`
  return (
    <article
      className={`group/artifact min-w-0 ${transcript ? 'rounded-r6 border border-border bg-panel p-3' : 'rounded-r4 px-p2 py-1'}`}
      aria-label={artifact.title}
    >
      <div className="flex min-w-0 items-center gap-g3">
        <button
          type="button"
          data-artifact-preview={artifact.publicationId}
          onClick={(event) => onPreview(artifact, event.currentTarget)}
          disabled={file?.busy}
          aria-label={tr('chat.artifactViewer.open', { title: artifact.title })}
          className="flex min-w-0 flex-1 items-center gap-g3 rounded-r4 text-left transition-colors hover:bg-bg2 hide-focus-ring ring-focus disabled:opacity-50"
        >
          <span
            aria-hidden
            className={
              transcript
                ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-r4 border border-t5 bg-bg2 text-ink2'
                : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-r4 bg-bg2 text-ink3'
            }
          >
            <Icon
              name={
                artifact.kind === 'image'
                  ? 'cam'
                  : artifact.kind === 'text' || artifact.kind === 'html'
                    ? 'code'
                    : 'doc'
              }
              size={transcript ? 20 : 17}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div
              className={`${transcript ? 'text-body' : 'text-footnote'} truncate font-medium text-ink`}
              title={`${artifact.title}\n${metadata}`}
            >
              {artifact.title}
            </div>
            {transcript && (
              <div className="text-caption text-ink3">
                {ordinaryFile
                  ? format || tr('chat.artifacts.fileLabel')
                  : tr('chat.artifacts.artifactLabel')}
              </div>
            )}
          </div>
        </button>
        {transcript ? (
          <Button
            size="small"
            variant="contained"
            leadingIcon="download"
            className="shrink-0"
            disabled={disabled || !present}
            aria-label={tr('chat.artifacts.download')}
            title={tr('chat.artifacts.save')}
            onClick={() => onAction(artifact, 'save')}
          >
            {tr('chat.artifacts.download')}
          </Button>
        ) : (
          <span className="shrink-0 text-caption text-ink3">
            {ordinaryFile
              ? format || tr('chat.artifacts.fileLabel')
              : tr('chat.artifacts.artifactLabel')}
          </span>
        )}
        <Button
          ref={menuRef}
          size="small"
          iconOnly
          className={
            transcript
              ? 'shrink-0'
              : 'shrink-0 opacity-0 group-hover/artifact:opacity-100 focus:opacity-100'
          }
          aria-label={tr('chat.artifacts.actions')}
          expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="kebab" size={14} />
        </Button>
      </div>
      {(file?.busy ? transcript : checking || !present) && (
        <div className="mt-1 text-caption text-ink2" role="status">
          {file?.busy
            ? tr('chat.artifacts.working')
            : checking
              ? tr('chat.artifacts.checking')
              : file?.availability?.state === 'missing'
                ? tr('chat.artifacts.missing')
                : tr('chat.artifacts.unavailable')}
        </div>
      )}
      {!present && !checking && (
        <div className="mt-1 flex flex-wrap gap-1">
          <Button size="small" disabled={disabled} onClick={onRefresh}>
            {tr('chat.artifacts.refresh')}
          </Button>
        </div>
      )}
      <Popover
        open={menuOpen}
        anchorRef={menuRef}
        onClose={() => setMenuOpen(false)}
        placement="bottom"
        align="end"
      >
        <MenuItem
          icon="download"
          disabled={disabled || !present}
          onClick={() => {
            setMenuOpen(false)
            onAction(artifact, 'save')
          }}
        >
          {tr('chat.artifacts.save')}
        </MenuItem>
        <MenuItem
          icon="folder"
          disabled={disabled || !present}
          onClick={() => {
            setMenuOpen(false)
            onAction(artifact, 'reveal')
          }}
        >
          {tr('chat.artifacts.reveal')}
        </MenuItem>
        <MenuItem
          icon="refresh"
          disabled={disabled}
          onClick={() => {
            setMenuOpen(false)
            onRefresh()
          }}
        >
          {tr('chat.artifacts.refresh')}
        </MenuItem>
        <MenuItem
          danger
          icon="trash"
          disabled={disabled || !present}
          onClick={() => {
            setMenuOpen(false)
            onAction(artifact, 'trash')
          }}
        >
          {tr('chat.artifacts.trash')}
        </MenuItem>
      </Popover>
    </article>
  )
}

export function ArtifactCards({
  artifacts,
  saveArtifacts = artifacts,
  variant = 'transcript'
}: {
  artifacts: readonly ArtifactRef[]
  saveArtifacts?: readonly ArtifactRef[]
  variant?: 'transcript' | 'list'
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const sessionId = useChatSession((session) => session.sessionId)
  const activeKey = useChatStore((state) => state.activeKey)
  const files = useArtifactStore((state) =>
    sessionId ? (state.sessions[sessionId]?.files ?? EMPTY_FILES) : EMPTY_FILES
  )
  const [result, setResult] = useState<{
    sessionId: string
    result: ArtifactOperationResult
    refs: readonly ArtifactRef[]
  } | null>(null)
  const [previousSession, setPreviousSession] = useState(sessionId)
  if (previousSession !== sessionId) {
    setPreviousSession(sessionId)
    setResult(null)
  }
  const generation = useRef(0)
  const getSnapshot = useEffectEvent(() => ({ artifacts, saveArtifacts }))
  const visibleKey = JSON.stringify(artifacts.map((ref) => [ref.publicationId, ref.artifactFileId]))
  const collectionKey = JSON.stringify(
    saveArtifacts.map((ref) => [ref.publicationId, ref.artifactFileId])
  )
  useEffect(() => {
    generation.current += 1
    if (!sessionId) return
    const snapshot = getSnapshot()
    const release = acquireArtifacts(sessionId, snapshot.saveArtifacts)
    void refreshArtifactStatuses(sessionId, snapshot.artifacts)
    return () => {
      generation.current += 1
      release()
    }
  }, [sessionId, visibleKey, collectionKey])
  if (!artifacts.length || !sessionId) return null

  const run = async (refs: readonly ArtifactRef[], operation: ArtifactOperation): Promise<void> => {
    const token = ++generation.current
    const captured = [...refs]
    setResult(null)
    const next = await runArtifactAction(sessionId, captured, operation)
    if (generation.current === token) setResult({ sessionId, result: next, refs: captured })
  }
  const act = (artifact: ArtifactRef, operation: ArtifactOperation): void => {
    if (operation !== 'trash') {
      void run([artifact], operation)
      return
    }
    openConfirmDialog({
      title: tr('chat.artifacts.trashTitle'),
      message: tr('chat.artifacts.trashMessage'),
      confirmLabel: tr('chat.artifacts.trash'),
      danger: true,
      onConfirm: () => {
        void run([artifact], 'trash')
      }
    })
  }
  const outcome = result?.sessionId === sessionId ? result.result : undefined
  const issues = artifactOperationIssues(outcome)
  return (
    <div className={`flex min-w-0 flex-col ${variant === 'list' ? 'gap-1' : 'gap-2'}`}>
      {variant === 'transcript' && saveArtifacts.length > 1 && (
        <div className="flex justify-end">
          <Button
            size="small"
            disabled={saveArtifacts.some((ref) => files[ref.artifactFileId]?.busy)}
            onClick={() => {
              void run(saveArtifacts, 'save')
            }}
          >
            {tr('chat.artifacts.saveAll')}
          </Button>
        </div>
      )}
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.publicationId}
          artifact={artifact}
          variant={variant}
          file={files[artifact.artifactFileId]}
          onPreview={(selected, origin) => {
            if (useChatStore.getState().activeKey !== activeKey) return
            void openArtifactViewer(activeKey, sessionId, selected, origin)
          }}
          onAction={act}
          onRefresh={() => {
            void refreshArtifactStatuses(sessionId, [artifact])
          }}
        />
      ))}
      {issues.length > 0 && (
        <div role="status" className="text-caption text-ink2">
          {issues.map((issue, index) => (
            <div key={issue.publicationId ?? index}>
              {issue.publicationId &&
                `${result?.refs.find((ref) => ref.publicationId === issue.publicationId)?.filename ?? issue.publicationId}: `}
              {tr(
                issue.unrecorded
                  ? 'chat.artifacts.trashedUnrecorded'
                  : artifactFailureKey(issue.reason)
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
