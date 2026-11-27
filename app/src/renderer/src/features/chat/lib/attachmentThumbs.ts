import type { AttachmentView, ComposerAttachment } from '../../../../../shared/ipc'

type AttachmentThumbnail =
  { state: 'pending' | 'unavailable' } | { state: 'ready'; dataUrl: string }

export interface DraftAttachment {
  id: string
  source: ComposerAttachment
  thumbnail: AttachmentThumbnail
}

export function attachmentView({ id, source, thumbnail }: DraftAttachment): AttachmentView {
  return {
    id,
    name: source.name,
    mimeType: source.mimeType,
    kind: source.mimeType.startsWith('image/') ? 'image' : 'file',
    ...(source.sizeBytes !== undefined ? { sizeBytes: source.sizeBytes } : {}),
    ...(thumbnail.state === 'ready' ? { previewDataUrl: thumbnail.dataUrl } : {})
  }
}
