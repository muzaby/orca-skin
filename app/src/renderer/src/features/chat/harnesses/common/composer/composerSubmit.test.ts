// 썸네일 실패·예외가 있어도 전송은 끝난다 (0325 VP-29 · VP-30 t10 · EP-9 · D-041).
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AttachmentView, ComposerAttachment } from '../../../../../../../shared/ipc'
import { buildAttachmentViews } from '../../../lib/attachmentViews'
import { downscaleDataUrl } from '../../../lib/imageThumb'
import { installFakeCanvas } from '../../../lib/imageThumb.testfixture'
import { createDraftSnapshot } from './draftSnapshot'
import { submitComposerInput } from './composerSubmit'

afterEach(() => vi.unstubAllGlobals())

const image = (name: string): ComposerAttachment => ({
  kind: 'inline',
  data: `DATA-${name}`,
  name,
  mimeType: 'image/png',
  sizeBytes: 10,
  sourceKind: 'clipboard'
})

function submit(
  items: ComposerAttachment[],
  build: (items: ComposerAttachment[]) => Promise<AttachmentView[]>
): { done: Promise<void>; onSend: ReturnType<typeof vi.fn> } {
  const submitted = createDraftSnapshot('보낼 글')
  const onSend = vi.fn(() => true)
  const done = submitComposerInput({
    submitted,
    submittedRequirements: { anchors: [] } as never,
    items,
    buildAttachmentViews: build,
    onSend,
    compositionActive: () => false,
    currentDraft: () => submitted,
    resetAttachmentsIfUnchanged: () => true,
    onClearDiffRequirementsIfUnchanged: () => {},
    updateSnapshot: () => {},
    focus: () => {}
  })
  return { done, onSend }
}

describe('submitComposerInput 첨부 썸네일', () => {
  it('sends the original attachment array even when a thumbnail fails', async () => {
    const items = [image('a.png'), image('b.png')]
    const { done, onSend } = submit(items, (list) =>
      buildAttachmentViews(list, {
        readAttachment: async () => null,
        downscale: async (dataUrl) =>
          dataUrl.includes('a.png')
            ? { ok: false, reason: 'encode' }
            : { ok: true, dataUrl: 'thumb' },
        newId: () => 'id'
      })
    )
    await done
    expect(onSend).toHaveBeenCalledOnce()
    const [, attachments, views] = onSend.mock.calls[0]
    expect(attachments).toBe(items)
    expect(attachments).toEqual([image('a.png'), image('b.png')])
    expect((views as AttachmentView[]).map((view) => view.previewDataUrl)).toEqual([
      undefined,
      'thumb'
    ])
  })

  it('t10 이미지 2개 중 첫째의 `drawImage` 가 던져도 뷰 2개 · `onSend` 1회', async () => {
    installFakeCanvas({})
    let calls = 0
    // 첫 canvas 의 drawImage 만 던진다.
    const realCreate = (document as unknown as { createElement: () => Record<string, unknown> })
      .createElement
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas = realCreate()
        const context = (canvas.getContext as () => Record<string, unknown>)()
        return {
          ...canvas,
          getContext: () => ({
            drawImage: (...args: unknown[]) => {
              if (calls++ === 0) throw new Error('draw failed')
              return (context.drawImage as (...a: unknown[]) => void)(...args)
            }
          })
        }
      }
    })
    const items = [image('a.png'), image('b.png')]
    const { done, onSend } = submit(items, (list) =>
      buildAttachmentViews(list, {
        readAttachment: async () => null,
        downscale: downscaleDataUrl,
        newId: () => 'id'
      })
    )
    await done
    expect(onSend).toHaveBeenCalledOnce()
    const views = onSend.mock.calls[0][2] as AttachmentView[]
    expect(views).toHaveLength(2)
    expect(views.map((view) => view.previewDataUrl)).toEqual([
      undefined,
      'data:image/jpeg;base64,THUMB'
    ])
  })
})
