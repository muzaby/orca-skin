import { useRef, useState } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { useI18n } from '../../../shared/i18n'
import type { ArtifactFileView, ArtifactOperation } from '../store/artifactStore'

interface ArtifactCardProps {
  artifact: ArtifactRef
  variant?: 'transcript' | 'list'
  file?: ArtifactFileView
  /** 미리보기 결과를 기다리는 중 — 뷰어 공간 대신 이 버튼만 busy 로 표시한다(0242 ΔV4). */
  opening?: boolean
  onAction: (artifact: ArtifactRef, action: ArtifactOperation) => void
  onPreview: (artifact: ArtifactRef, origin: HTMLElement) => void
}

export function ArtifactCard({
  artifact,
  variant = 'transcript',
  file,
  opening = false,
  onAction,
  onPreview
}: ArtifactCardProps): React.JSX.Element {
  const { tr } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  // 0242 ΔV2 (D-011·D-012) — 가용성(없음·접근 불가·확인 중)은 카드에 미리 드러내지 않는다.
  // 동작은 작업 중에만 막고, 불가 사유는 사용자가 동작을 요청했을 때 toast 로 알린다.
  const disabled = !!file?.busy
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
          aria-busy={opening || undefined}
          aria-label={tr('chat.artifactViewer.open', { title: artifact.title })}
          className="flex min-w-0 flex-1 items-center gap-g3 rounded-r4 text-left transition-colors hover:bg-bg2 hide-focus-ring ring-focus disabled:opacity-50 aria-busy:cursor-progress"
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
            disabled={disabled}
            aria-label={tr('chat.artifacts.download')}
            title={tr('chat.artifacts.download')}
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
          title={tr('common.more')}
          expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="kebab" size={14} />
        </Button>
      </div>
      <Popover
        open={menuOpen}
        anchorRef={menuRef}
        onClose={() => setMenuOpen(false)}
        placement="bottom"
        align="end"
      >
        <MenuItem
          icon="download"
          disabled={disabled}
          onClick={() => {
            setMenuOpen(false)
            onAction(artifact, 'save')
          }}
        >
          {tr('chat.artifacts.save')}
        </MenuItem>
        <MenuItem
          icon="fileOpen"
          disabled={disabled}
          onClick={() => {
            setMenuOpen(false)
            onAction(artifact, 'reveal')
          }}
        >
          {tr('chat.artifacts.reveal')}
        </MenuItem>
        <MenuItem
          danger
          icon="trash"
          disabled={disabled}
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
