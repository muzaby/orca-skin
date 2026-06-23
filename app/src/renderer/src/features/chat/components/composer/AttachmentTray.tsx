import type { ComposerAttachment } from '../../../../../../shared/ipc'
import { AttachmentChip } from './AttachmentChip'

interface AttachmentTrayProps {
  attachments: ComposerAttachment[]
  previews: Record<string, string>
  onRemove: (index: number) => void
}

export function AttachmentTray({
  attachments,
  previews,
  onRemove
}: AttachmentTrayProps): React.JSX.Element | null {
  if (attachments.length === 0) return null
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) => (
        <AttachmentChip
          key={`${attachment.name}-${index}`}
          attachment={attachment}
          previewUrl={previews[`${attachment.name}-${index}`]}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  )
}
