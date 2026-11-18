import { reportError } from '../../../shared/errors'
import { useRef, useState, type ClipboardEvent } from 'react'
import { fileApi } from '../../../shared/api/ipc'
import { downscaleDataUrl } from '../lib/imageThumb'
import { buildAttachmentViews as buildViews } from '../lib/attachmentViews'
import type { AttachmentView, ComposerAttachment } from '../../../../../shared/ipc'

// 컴포저의 첨부 lifecycle(다이얼로그/DnD/붙여넣기 3경로 수집 · 미리보기 · 제거 · 전송용 뷰 빌드)를
// 한곳에 가둔다. 컴포저는 입력 합성에 집중하고, 첨부 상태/핸들러는 이 훅이 소유한다(AGENTS.md §5 분해).
export interface UseAttachments {
  attachments: ComposerAttachment[]
  attachmentPreviews: Record<string, string>
  draggingAttachment: boolean
  setDraggingAttachment: (dragging: boolean) => void
  pickAttachments: () => Promise<void>
  removeAttachment: (index: number) => void
  addDroppedFiles: (files: FileList) => Promise<void>
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void
  buildAttachmentViews: (items: ComposerAttachment[]) => Promise<AttachmentView[]>
  resetIfUnchanged: (expected: ComposerAttachment[]) => boolean
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

export function useAttachments(): UseAttachments {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const attachmentsRef = useRef(attachments)
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({})
  const [draggingAttachment, setDraggingAttachment] = useState(false)

  // React state와 async submit이 읽는 ref는 반드시 같은 배열 identity를 가리켜야 한다.
  // 한쪽만 새 배열로 바뀌면 resetIfUnchanged가 사용자 변경으로 오판해 draft clear까지 막는다.
  const commitAttachments = (next: ComposerAttachment[]): void => {
    attachmentsRef.current = next
    setAttachments(next)
  }

  const addAttachments = async (items: ComposerAttachment[]): Promise<void> => {
    const startIndex = attachmentsRef.current.length
    const nextAttachments = [...attachmentsRef.current, ...items]
    commitAttachments(nextAttachments)
    const previews: Record<string, string> = {}
    await Promise.all(
      items.map(async (att, offset) => {
        if (!att.mimeType.startsWith('image/')) return
        const key = `${att.name}-${startIndex + offset}`
        if (att.kind === 'inline') previews[key] = `data:${att.mimeType};base64,${att.data}`
        else {
          const result = await fileApi.readAttachment(att.path).catch(() => null)
          if (result) previews[key] = `data:${result.mimeType};base64,${result.data}`
        }
      })
    )
    if (Object.keys(previews).length > 0) {
      setAttachmentPreviews((current) => ({ ...current, ...previews }))
    }
  }

  const pickAttachments = async (): Promise<void> => {
    const picked = await fileApi.pickAttachments().catch((error) => {
      reportError({
        event: 'chat.attachment.pick-failed',
        scope: 'chat',
        title: 'attachFailed',
        error: error
      })
      return []
    })
    await addAttachments(
      picked.map((p) => ({
        kind: 'path' as const,
        path: p.path,
        name: p.name,
        mimeType: p.mimeType,
        sizeBytes: p.sizeBytes,
        sourceKind: 'dialog' as const
      }))
    )
  }

  const removeAttachment = (index: number): void => {
    const removed = attachmentsRef.current[index]
    const nextAttachments = attachmentsRef.current.filter((_, current) => current !== index)
    commitAttachments(nextAttachments)
    setAttachmentPreviews((current) => {
      const next = { ...current }
      delete next[`${removed?.name ?? ''}-${index}`]
      return next
    })
  }

  const addDroppedFiles = async (files: FileList): Promise<void> => {
    const next: ComposerAttachment[] = []
    for (const file of Array.from(files)) {
      const path = fileApi.pathForFile(file)
      if (path) {
        next.push({
          kind: 'path',
          path,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          sourceKind: 'drag_drop'
        })
      }
    }
    await addAttachments(next)
  }

  const onPaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (files.length === 0) return
    event.preventDefault()
    void Promise.all(
      files.map(async (file): Promise<ComposerAttachment> => ({
        kind: 'inline',
        data: await readFileAsBase64(file),
        name: file.name || 'pasted-image.png',
        mimeType: file.type || 'image/png',
        sizeBytes: file.size,
        sourceKind: 'clipboard'
      }))
    ).then(addAttachments)
  }

  // 전송 시 영속·렌더용 첨부 뷰를 만든다 — 이미지는 다운스케일 썸네일로 줄여 DB/트랜스크립트에
  // 가볍게 남긴다. 실패한 썸네일은 미리보기 없이 보내고 동시 수는 2 다(`lib/attachmentViews`, 0325 EP-9 ⑤).
  const buildAttachmentViews = (items: ComposerAttachment[]): Promise<AttachmentView[]> =>
    buildViews(items, {
      readAttachment: (path) => fileApi.readAttachment(path),
      downscale: downscaleDataUrl,
      newId: () => crypto.randomUUID()
    })

  // attachment view 생성은 비동기다. 그 사이 새 첨부가 추가/제거됐다면 전송 당시 배열만
  // 지운다는 보장이 없으므로 clear를 거부한다. controller가 draft revision과 함께 검사해
  // text+attachments를 하나의 submit snapshot처럼 다룬다. 배열 identity 가 optimistic
  // concurrency token — 전송 시점 그대로일 때만 비운다.
  const resetIfUnchanged = (expected: ComposerAttachment[]): boolean => {
    if (attachmentsRef.current !== expected) return false
    commitAttachments([])
    setAttachmentPreviews({})
    return true
  }

  return {
    attachments,
    attachmentPreviews,
    draggingAttachment,
    setDraggingAttachment,
    pickAttachments,
    removeAttachment,
    addDroppedFiles,
    onPaste,
    buildAttachmentViews,
    resetIfUnchanged
  }
}
