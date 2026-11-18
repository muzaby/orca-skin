// 전송용 첨부 뷰 — 실패한 썸네일은 미리보기 없음 · 동시 2 · 입력 순서 (0325 VP-30 t1~t8 · EP-9 ②~④).
import { describe, expect, it, vi } from 'vitest'
import type { ComposerAttachment } from '../../../../../shared/ipc'
import { buildAttachmentViews, THUMB_CONCURRENCY, type AttachmentViewDeps } from './attachmentViews'
import type { ThumbnailResult } from './imageThumb'

const inline = (name: string, mimeType = 'image/png'): ComposerAttachment => ({
  kind: 'inline',
  data: `DATA-${name}`,
  name,
  mimeType,
  sizeBytes: 10,
  sourceKind: 'clipboard'
})
const path = (name: string): ComposerAttachment =>
  ({ kind: 'path', path: `/tmp/${name}`, name, mimeType: 'image/png' }) as ComposerAttachment

function deps(overrides: Partial<AttachmentViewDeps> = {}): AttachmentViewDeps {
  let id = 0
  return {
    readAttachment: async (file) => ({ mimeType: 'image/png', data: `READ-${file}` }),
    downscale: async (dataUrl) => ({ ok: true, dataUrl: `thumb:${dataUrl}` }),
    newId: () => `id-${++id}`,
    ...overrides
  }
}

describe('buildAttachmentViews', () => {
  it('t1 성공 → 썸네일 · t7 성공 뷰의 미리보기는 원본 data URL 이 아니다', async () => {
    const [view] = await buildAttachmentViews([inline('a.png')], deps())
    expect(view).toMatchObject({ name: 'a.png', kind: 'image', sizeBytes: 10 })
    expect(view.previewDataUrl).toBe('thumb:data:image/png;base64,DATA-a.png')
    expect(view.previewDataUrl).not.toBe('data:image/png;base64,DATA-a.png')
  })

  it.each(['load', 'canvas', 'encode'] as const)(
    't2~t4 %s 실패 → 미리보기 없음',
    async (reason) => {
      const [view] = await buildAttachmentViews(
        [inline('a.png')],
        deps({ downscale: async () => ({ ok: false, reason }) })
      )
      expect(view.kind).toBe('image')
      expect('previewDataUrl' in view).toBe(false)
    }
  )

  it('t5 비이미지 → downscale 0', async () => {
    const downscale = vi.fn(async (): Promise<ThumbnailResult> => ({ ok: true, dataUrl: 'x' }))
    const [view] = await buildAttachmentViews([inline('a.txt', 'text/plain')], deps({ downscale }))
    expect(view.kind).toBe('file')
    expect(downscale).not.toHaveBeenCalled()
  })

  it('t6 경로 읽기 실패 → 미리보기 없음', async () => {
    const views = await buildAttachmentViews(
      [path('a.png'), path('b.png')],
      deps({
        readAttachment: async (file) => {
          if (file.endsWith('a.png')) throw new Error('missing')
          return null
        }
      })
    )
    expect(views.map((view) => 'previewDataUrl' in view)).toEqual([false, false])
  })

  it('t8 5개 → 동시 최대 2 · 결과 순서는 입력 순서', async () => {
    expect(THUMB_CONCURRENCY).toBe(2)
    let active = 0
    let peak = 0
    const gates = new Map<string, () => void>()
    const downscale = (dataUrl: string): Promise<ThumbnailResult> => {
      active++
      peak = Math.max(peak, active)
      return new Promise((resolve) =>
        gates.set(dataUrl, () => {
          active--
          resolve({ ok: true, dataUrl: `thumb:${dataUrl}` })
        })
      )
    }
    const items = ['a', 'b', 'c', 'd', 'e'].map((name) => inline(`${name}.png`))
    const pending = buildAttachmentViews(items, deps({ downscale }))
    const tick = async (): Promise<void> => {
      for (let i = 0; i < 5; i++) await Promise.resolve()
    }
    // 해소 순서를 뒤섞는다 — 늦게 시작한 것을 먼저 푼다.
    for (const order of [1, 0, 3, 2, 4]) {
      await tick()
      const key = `data:image/png;base64,DATA-${'abcde'[order]}.png`
      expect(gates.has(key)).toBe(true)
      gates.get(key)!()
    }
    const views = await pending
    expect(peak).toBe(2)
    expect(views.map((view) => view.name)).toEqual(['a.png', 'b.png', 'c.png', 'd.png', 'e.png'])
    expect(views.every((view) => view.previewDataUrl?.startsWith('thumb:'))).toBe(true)
  })
})
