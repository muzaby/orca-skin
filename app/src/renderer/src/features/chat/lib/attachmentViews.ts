// 전송용 첨부 뷰 (0325 D-012 · D-041 · EP-9 ②~④). 이미지는 다운스케일 썸네일을 미리보기로 단다 —
// 썸네일을 만들지 못하면 그 뷰에 미리보기를 두지 않는다(원본 data URL 대체 금지). 썸네일 준비는 한
// 전송에서 동시에 `THUMB_CONCURRENCY` 개까지 돌고, 결과 순서는 입력 순서다. 이 상한은 canvas 작업 수
// 상한이지 디코딩 픽셀·전송 지연의 상한이 아니다(0325 B17).

import type { AttachmentView, ComposerAttachment } from '../../../../../shared/ipc'
import type { ThumbnailResult } from './imageThumb'

export const THUMB_CONCURRENCY = 2

export interface AttachmentViewDeps {
  readAttachment(path: string): Promise<{ mimeType: string; data: string } | null | undefined>
  downscale(dataUrl: string): Promise<ThumbnailResult>
  newId(): string
}

// 썸네일은 컴포저의 비동기 미리보기 state 가 아니라 소스에서 직접 만든다(path=읽기, inline=보유 바이트).
async function sourceDataUrl(
  attachment: ComposerAttachment,
  deps: AttachmentViewDeps
): Promise<string | undefined> {
  if (attachment.kind === 'inline') return `data:${attachment.mimeType};base64,${attachment.data}`
  const read = await deps.readAttachment(attachment.path).catch(() => null)
  return read ? `data:${read.mimeType};base64,${read.data}` : undefined
}

async function buildView(
  attachment: ComposerAttachment,
  deps: AttachmentViewDeps
): Promise<AttachmentView> {
  const isImage = attachment.mimeType.startsWith('image/')
  const view: AttachmentView = {
    id: deps.newId(),
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: isImage ? 'image' : 'file',
    ...(attachment.sizeBytes !== undefined ? { sizeBytes: attachment.sizeBytes } : {})
  }
  if (!isImage) return view
  const full = await sourceDataUrl(attachment, deps)
  if (!full) return view
  const thumbnail = await deps
    .downscale(full)
    .catch((): ThumbnailResult => ({ ok: false, reason: 'load' }))
  if (thumbnail.ok) view.previewDataUrl = thumbnail.dataUrl
  return view
}

export async function buildAttachmentViews(
  items: readonly ComposerAttachment[],
  deps: AttachmentViewDeps
): Promise<AttachmentView[]> {
  const views: AttachmentView[] = new Array(items.length)
  let next = 0
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++
      views[index] = await buildView(items[index], deps)
    }
  }
  await Promise.all(Array.from({ length: Math.min(THUMB_CONCURRENCY, items.length) }, lane))
  return views
}
