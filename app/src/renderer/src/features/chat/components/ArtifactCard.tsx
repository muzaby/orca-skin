import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { artifactApi } from '../../../shared/api/ipc'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { useI18n, type MessageKey } from '../../../shared/i18n'
import { useChatSession } from '../store/chatStore'
import {
  acquireArtifacts,
  refreshArtifactStatuses,
  runArtifactAction,
  useArtifactStore,
  type ArtifactFileView,
  type ArtifactOperation,
  type ArtifactOperationResult
} from '../store/artifactStore'

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
  onOpenFolder: () => void
}

export function ArtifactCard({
  artifact,
  variant = 'transcript',
  file,
  onAction,
  onRefresh,
  onOpenFolder
}: ArtifactCardProps): React.JSX.Element {
  const { tr } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const checking = !file?.availability || file.checking
  const present = file?.availability?.state === 'present'
  const disabled = checking || file?.busy
  const transcript = variant === 'transcript'
  const format = artifact.kind === 'html' ? 'HTML' : 'MD'
  const metadata = `${artifact.filename} · ${tr('chat.artifacts.bytes', { count: artifact.sizeBytes })} · ${new Date(artifact.publishedAt).toLocaleString()}`
  return (
    <article
      className={`group/artifact min-w-0 ${transcript ? 'rounded-r6 border border-border bg-panel p-3' : 'rounded-r4 px-p2 py-2'}`}
      aria-label={artifact.title}
    >
      <div className="flex min-w-0 items-center gap-g3">
        <span
          aria-hidden
          className={
            transcript
              ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-r4 border border-t5 bg-bg2 text-ink2'
              : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-r4 bg-bg2 text-ink3'
          }
        >
          <Icon name={transcript ? 'doc' : 'layers'} size={transcript ? 20 : 17} />
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
              {tr('chat.artifacts.document')} · {format}
            </div>
          )}
        </div>
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
            {tr('chat.artifacts.artifactLabel')}
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
      {(file?.busy || checking || !present) && (
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
      {file?.lastTrashedAt && (
        <div className="mt-1 text-caption text-ink3">
          {tr('chat.artifacts.trashedAt', { time: new Date(file.lastTrashedAt).toLocaleString() })}
        </div>
      )}
      {!present && !checking && (
        <div className="mt-1 flex flex-wrap gap-1">
          <Button size="small" disabled={file?.busy} onClick={onOpenFolder}>
            {tr('chat.artifacts.openFolder')}
          </Button>
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
        <div className="max-w-64 break-words px-2.5 py-1 text-caption text-ink3">{metadata}</div>
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
        <MenuItem
          icon="folder"
          onClick={() => {
            setMenuOpen(false)
            onOpenFolder()
          }}
        >
          {tr('chat.artifacts.openFolder')}
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
  const openFolder = async (): Promise<void> => {
    const token = ++generation.current
    try {
      const next = await artifactApi.openFolder()
      if (generation.current === token) setResult({ sessionId, result: next, refs: [] })
    } catch {
      if (generation.current === token) setResult({ sessionId, result: { ok: false }, refs: [] })
    }
  }
  const outcome = result?.sessionId === sessionId ? result.result : undefined
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {saveArtifacts.length > 1 && (
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
          onAction={act}
          onRefresh={() => {
            void refreshArtifactStatuses(sessionId, [artifact])
          }}
          onOpenFolder={() => {
            void openFolder()
          }}
        />
      ))}
      {outcome && (
        <div role="status" className="text-caption text-ink2">
          {'items' in outcome ? (
            <>
              {tr(
                outcome.outcome === 'cancelled'
                  ? 'chat.artifacts.cancelled'
                  : outcome.outcome === 'failed'
                    ? 'chat.artifacts.failed'
                    : 'chat.artifacts.saveComplete'
              )}
              {outcome.reason && <p>{tr(artifactFailureKey(outcome.reason))}</p>}
              {outcome.items.map((item) => (
                <div key={item.publicationId}>
                  {result?.refs.find((ref) => ref.publicationId === item.publicationId)?.filename ??
                    item.publicationId}
                  :{' '}
                  {tr(
                    item.outcome === 'saved'
                      ? 'chat.artifacts.saved'
                      : item.outcome === 'skipped'
                        ? 'chat.artifacts.skipped'
                        : 'chat.artifacts.failed'
                  )}
                  {item.reason && <> — {tr(artifactFailureKey(item.reason))}</>}
                </div>
              ))}
            </>
          ) : 'ok' in outcome ? (
            tr(outcome.ok ? 'chat.artifacts.done' : artifactFailureKey(outcome.reason))
          ) : (
            tr(
              outcome.outcome === 'trashed'
                ? outcome.deletionRecorded
                  ? 'chat.artifacts.trashed'
                  : 'chat.artifacts.trashedUnrecorded'
                : outcome.outcome === 'already-missing'
                  ? 'chat.artifacts.missing'
                  : artifactFailureKey(outcome.reason)
            )
          )}
        </div>
      )}
    </div>
  )
}
