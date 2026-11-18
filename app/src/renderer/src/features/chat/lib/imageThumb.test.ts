// 썸네일 결과 — 실패·예외는 원본 대신 실패 이유로 settle 한다 (0325 VP-30 · EP-9 ① · D-041).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downscaleDataUrl } from './imageThumb'
import { installFakeCanvas } from './imageThumb.testfixture'

afterEach(() => vi.unstubAllGlobals())

describe('downscaleDataUrl', () => {
  const source = 'data:image/png;base64,ORIGINAL'

  it('성공 → 썸네일 data URL', async () => {
    installFakeCanvas({})
    expect(await downscaleDataUrl(source)).toEqual({
      ok: true,
      dataUrl: 'data:image/jpeg;base64,THUMB'
    })
  })

  it.each([
    ['load', { load: false }],
    ['canvas', { context: false }],
    ['canvas', { createThrows: true }],
    ['encode', { encode: 'throw' as const }]
  ] as const)('실패 → { ok:false, reason: %s }', async (reason, options) => {
    const fake = installFakeCanvas(options)
    expect(await downscaleDataUrl(source)).toEqual({ ok: false, reason })
    expect(fake.unhandled).toEqual([])
  })

  it('t9 `onload` 에서 `drawImage` 가 던짐 → { ok:false, reason:"draw" } 로 settle · 처리되지 않은 예외 0', async () => {
    const fake = installFakeCanvas({ draw: 'throw' })
    expect(await downscaleDataUrl(source)).toEqual({ ok: false, reason: 'draw' })
    expect(fake.unhandled).toEqual([])
  })
})
