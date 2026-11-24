import type { DraftAttachment } from '../../../lib/attachmentThumbs'
import { AttachmentChip } from './AttachmentChip'

interface AttachmentTrayProps {
  attachments: readonly DraftAttachment[]
  onRemove: (id: string) => void
}

export function AttachmentTray({
  attachments,
  onRemove
}: AttachmentTrayProps): React.JSX.Element | null {
  if (attachments.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map(({ id, source, thumbnail }) => (
        <AttachmentChip
          key={id}
          attachment={source}
          previewUrl={thumbnail.state === 'ready' ? thumbnail.dataUrl : undefined}
          onRemove={() => onRemove(id)}
        />
      ))}
    </div>
  )
}
