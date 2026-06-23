import { AttachmentThumb } from './AttachmentThumb'
import type { ComposerAttachment } from '../../../../../../shared/ipc'

interface AttachmentChipProps {
  attachment: ComposerAttachment
  previewUrl?: string
  onRemove: () => void
}

// 컴포저 첨부 칩 — ComposerAttachment 를 공유 썸네일(제거 버튼 포함)로 투영한다.
export function AttachmentChip({
  attachment,
  previewUrl,
  onRemove
}: AttachmentChipProps): React.JSX.Element {
  return (
    <AttachmentThumb
      name={attachment.name}
      isImage={attachment.mimeType.startsWith('image/')}
      previewUrl={previewUrl}
      onRemove={onRemove}
    />
  )
}
