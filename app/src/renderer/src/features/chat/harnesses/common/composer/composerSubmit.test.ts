import { expect, it, vi } from 'vitest'
import type { ComposerAttachment } from '../../../../../../../shared/ipc'
import { attachmentView, type DraftAttachment } from '../../../lib/attachmentThumbs'
import { createDraftSnapshot } from './draftSnapshot'
import { submitComposerInput } from './composerSubmit'

it('sends each original in order and uses only thumbnails ready at the instant of submission', () => {
  const items: ComposerAttachment[] = Array.from({ length: 5 }, (_, index) => ({
    kind: 'inline',
    data: `original-${index}`,
    mimeType: 'image/png',
    name: 'same.png',
    sourceKind: 'clipboard'
  }))
  const thumbnails: DraftAttachment['thumbnail'][] = [
    { state: 'ready', dataUrl: 'data:image/jpeg;base64,THUMB1' },
    { state: 'pending' },
    { state: 'unavailable' },
    { state: 'ready', dataUrl: 'data:image/jpeg;base64,THUMB2' },
    { state: 'pending' }
  ]
  const submitted = createDraftSnapshot('보낼 글')
  const onSend = vi.fn(() => true)
  const focus = vi.fn()
  const reset = vi.fn(() => true)
  const views = items.map((source, index) =>
    attachmentView({ id: String(index), source, thumbnail: thumbnails[index] })
  )
  submitComposerInput({
    submitted,
    submittedRequirements: { anchors: [] } as never,
    items,
    views,
    onSend,
    compositionActive: () => false,
    currentDraft: () => submitted,
    resetAttachmentsIfUnchanged: reset,
    onClearDiffRequirementsIfUnchanged: () => {},
    updateSnapshot: () => {},
    focus
  })
  expect(onSend).toHaveBeenCalledExactlyOnceWith('보낼 글', items, views, [])
  expect(views.map((view) => view.previewDataUrl)).toEqual([
    'data:image/jpeg;base64,THUMB1',
    undefined,
    undefined,
    'data:image/jpeg;base64,THUMB2',
    undefined
  ])
  expect(reset).toHaveBeenCalledExactlyOnceWith(items)
  expect(focus).toHaveBeenCalledExactlyOnceWith(0)
})
