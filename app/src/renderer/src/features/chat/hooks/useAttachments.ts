import { useLayoutEffect, useRef, useState, type ClipboardEvent } from 'react'
import { reportError } from '../../../shared/errors'
import { fileApi } from '../../../shared/api/ipc'
import { computeClient } from '../../../shared/compute/client'
import { imagePixelCount } from '../../../shared/compute/imageHeader'
import { attachmentView, type DraftAttachment } from '../lib/attachmentThumbs'
import type { AttachmentView, ComposerAttachment } from '../../../../../shared/ipc'

export interface UseAttachments {
  chips: readonly DraftAttachment[]
  snapshot: () => { items: ComposerAttachment[]; views: AttachmentView[] }
  draggingAttachment: boolean
  setDraggingAttachment: (dragging: boolean) => void
  pickAttachments: () => Promise<void>
  addAttachments: (sources: ComposerAttachment[]) => void
  removeAttachment: (id: string) => void
  addDroppedFiles: (files: FileList) => void
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void
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
  const [chips, setChips] = useState<DraftAttachment[]>([])
  const drafts = useRef<DraftAttachment[]>([])
  const items = useRef<ComposerAttachment[]>([])
  const lifetime = useRef({ generation: 0 })
  const jobs = useRef(new Map<string, { cancel(): void }>())
  const [draggingAttachment, setDraggingAttachment] = useState(false)

  useLayoutEffect(() => {
    const active = lifetime.current
    const pending = jobs.current
    return () => {
      active.generation++
      for (const job of pending.values()) job.cancel()
      pending.clear()
      drafts.current = []
      items.current = []
    }
  }, [])

  function commit(next: DraftAttachment[]): void {
    drafts.current = next
    items.current = next.map((item) => item.source)
    setChips(next)
  }

  async function prepareThumbnail({ id, source }: DraftAttachment): Promise<void> {
    const alive = (): boolean => drafts.current.some((item) => item.id === id)
    let thumbnail: string | null = null
    try {
      const input = source.kind === 'inline' ? source : await fileApi.readAttachment(source.path)
      if (!alive()) return
      const handle = computeClient().request(
        {
          kind: 'imageThumb',
          attachmentId: id,
          mimeType: input.mimeType,
          data: input.data,
          // Only a bounded header sample is read for queue ordering. The worker checks
          // the header again before it decodes the image.
          pixels: imagePixelCount(input.mimeType, input.data) ?? 0
        },
        { priority: 'background', cacheable: false }
      )
      jobs.current.set(id, handle)
      thumbnail = (await handle.promise).thumbnail
    } catch {
      // Reads, decoding, and worker cancellation may leave the attachment without a preview.
    } finally {
      jobs.current.delete(id)
    }
    if (!alive()) return
    const next = drafts.current.map<DraftAttachment>((item) =>
      item.id === id
        ? {
            ...item,
            thumbnail: thumbnail ? { state: 'ready', dataUrl: thumbnail } : { state: 'unavailable' }
          }
        : item
    )
    drafts.current = next
    setChips(next)
  }

  function addAttachments(sources: ComposerAttachment[]): void {
    if (!sources.length) return
    const added = sources.map<DraftAttachment>((source) => ({
      id: crypto.randomUUID(),
      source,
      thumbnail: { state: source.mimeType.startsWith('image/') ? 'pending' : 'unavailable' }
    }))
    commit([...drafts.current, ...added])
    for (const item of added) {
      if (item.thumbnail.state === 'pending') void prepareThumbnail(item)
    }
  }

  async function pickAttachments(): Promise<void> {
    const { generation } = lifetime.current
    try {
      const picked = await fileApi.pickAttachments()
      if (generation !== lifetime.current.generation) return
      addAttachments(picked.map((file) => ({ ...file, kind: 'path', sourceKind: 'dialog' })))
    } catch (error) {
      if (generation !== lifetime.current.generation) return
      reportError({
        event: 'chat.attachment.pick-failed',
        scope: 'chat',
        title: 'attachFailed',
        error
      })
    }
  }

  function removeAttachment(id: string): void {
    if (!drafts.current.some((item) => item.id === id)) return
    commit(drafts.current.filter((item) => item.id !== id))
    jobs.current.get(id)?.cancel()
  }

  function addDroppedFiles(files: FileList): void {
    const next: ComposerAttachment[] = []
    for (const file of Array.from(files)) {
      const path = fileApi.pathForFile(file)
      if (!path) continue
      next.push({
        kind: 'path',
        path,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        sourceKind: 'drag_drop'
      })
    }
    addAttachments(next)
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>): void {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith('image/')
    )
    if (!files.length) return
    event.preventDefault()
    const { generation } = lifetime.current
    void Promise.allSettled(
      files.map(async (file): Promise<ComposerAttachment> => ({
        kind: 'inline',
        data: await readFileAsBase64(file),
        name: file.name || 'pasted-image.png',
        mimeType: file.type || 'image/png',
        sizeBytes: file.size,
        sourceKind: 'clipboard'
      }))
    ).then((results) => {
      if (generation !== lifetime.current.generation) return
      addAttachments(
        results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      )
    })
  }

  function resetIfUnchanged(expected: ComposerAttachment[]): boolean {
    if (items.current !== expected) return false
    lifetime.current.generation++
    const previous = drafts.current
    commit([])
    for (const { id } of previous) jobs.current.get(id)?.cancel()
    return true
  }

  return {
    chips,
    snapshot: () => ({ items: items.current, views: drafts.current.map(attachmentView) }),
    draggingAttachment,
    setDraggingAttachment,
    pickAttachments,
    removeAttachment,
    addAttachments,
    addDroppedFiles,
    onPaste,
    resetIfUnchanged
  }
}
