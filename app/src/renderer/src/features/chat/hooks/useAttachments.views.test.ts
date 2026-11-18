// 컴포저 훅의 전송 첨부 뷰 배선 (0325 EP-9 ⑤ · VP-29). 훅의 `buildAttachmentViews` 가 production 의존
// (경로 읽기 · `downscaleDataUrl` · id)으로 `lib/attachmentViews` 에 위임하는지 본다.
import { createElement, useLayoutEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposerAttachment } from '../../../../../shared/ipc'
import { installFakeDom } from '../../../shared/ui/renderHarness.testfixture'
import { installFakeCanvas } from '../lib/imageThumb.testfixture'
import { useAttachments, type UseAttachments } from './useAttachments'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))

afterEach(() => vi.unstubAllGlobals())

const hook = { value: undefined as unknown as UseAttachments }
function Probe(): null {
  const value = useAttachments()
  useLayoutEffect(() => {
    hook.value = value
  })
  return null
}

function mount(readAttachment: (path: string) => Promise<unknown>): () => void {
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  Object.assign(window, { oo: { files: { readAttachment } } })
  dom.render(createElement(Probe))
  return () => dom.unmount()
}

describe('useAttachments.buildAttachmentViews', () => {
  it('inline·경로 이미지 모두 production 썸네일로 미리보기를 단다', async () => {
    const readAttachment = vi.fn(async () => ({ mimeType: 'image/png', data: 'READ' }))
    const unmount = mount(readAttachment)
    installFakeCanvas({})
    const items: ComposerAttachment[] = [
      {
        kind: 'inline',
        data: 'DATA',
        name: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 3,
        sourceKind: 'clipboard'
      },
      {
        kind: 'path',
        path: '/tmp/b.png',
        name: 'b.png',
        mimeType: 'image/png'
      } as ComposerAttachment
    ]
    const views = await hook.value.buildAttachmentViews(items)
    unmount()
    expect(readAttachment).toHaveBeenCalledExactlyOnceWith('/tmp/b.png')
    expect(views.map((view) => view.previewDataUrl)).toEqual([
      'data:image/jpeg;base64,THUMB',
      'data:image/jpeg;base64,THUMB'
    ])
    expect(new Set(views.map((view) => view.id)).size).toBe(2)
  })

  it('썸네일이 실패하면 미리보기 없이 뷰를 만든다', async () => {
    const unmount = mount(async () => null)
    installFakeCanvas({ load: false })
    const views = await hook.value.buildAttachmentViews([
      {
        kind: 'inline',
        data: 'DATA',
        name: 'a.png',
        mimeType: 'image/png',
        sourceKind: 'clipboard'
      }
    ])
    unmount()
    expect(views).toHaveLength(1)
    expect('previewDataUrl' in views[0]).toBe(false)
  })
})
