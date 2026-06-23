import { Icon } from '../../../../shared/ui/Icon'
import type { ComposerAttachment } from '../../../../../../shared/ipc'

interface AttachmentChipProps {
  attachment: ComposerAttachment
  previewUrl?: string
  onRemove: () => void
}

function labelFor(att: ComposerAttachment): string {
  if (att.mimeType.startsWith('image/')) return '이미지'
  if (att.mimeType === 'text/markdown') return 'MD'
  return 'TXT'
}

export function AttachmentChip({
  attachment,
  previewUrl,
  onRemove
}: AttachmentChipProps): React.JSX.Element {
  const isImage = attachment.mimeType.startsWith('image/')
  return (
    <div className="group/attachment relative flex h-12 max-w-[220px] items-center gap-2 rounded-r4 border border-border bg-bg px-2 text-xs text-ink shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-r3 bg-sidebar text-ink3">
        {isImage && previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="doc" size={15} />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{attachment.name}</div>
        <div className="text-[10px] text-ink3">{labelFor(attachment)}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel text-ink3 opacity-0 shadow-sm transition group-hover/attachment:opacity-100 hover:text-ink"
        aria-label={`${attachment.name} 첨부 제거`}
      >
        <Icon name="x" size={10} />
      </button>
    </div>
  )
}
