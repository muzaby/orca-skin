import { afterEach, expect, it, vi } from 'vitest'
import { imagePixelCount } from '../imageHeader'
import { imageThumbnail } from './imageThumb'

function png(width: number, height: number): string {
  const bytes = new Uint8Array(33)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
  const header = new DataView(bytes.buffer)
  header.setUint32(16, width)
  header.setUint32(20, height)
  return btoa(String.fromCharCode(...bytes))
}

function jpeg(): string {
  return btoa(
    String.fromCharCode(
      0xff,
      0xd8,
      0xff,
      0xe0,
      0,
      8,
      0,
      0,
      0,
      0,
      0,
      0,
      0xff,
      0xc2,
      0,
      11,
      8,
      0,
      5,
      0,
      7,
      1,
      1,
      0x11,
      0,
      0xff,
      0xd9
    )
  )
}

function gif(screen: number, frame: number): string {
  return btoa(
    'GIF89a' +
      String.fromCharCode(
        screen,
        0,
        screen,
        0,
        0,
        0,
        0,
        0x2c,
        0,
        0,
        0,
        0,
        frame,
        0,
        frame,
        0,
        0,
        2,
        1,
        0,
        0,
        0x3b
      )
  )
}

function webp(type: 'VP8 ' | 'VP8L' | 'VP8X'): string {
  const vp8 = 'VP8 ' + String.fromCharCode(10, 0, 0, 0, 0, 0, 0, 0x9d, 1, 0x2a, 7, 0, 5, 0)
  const payload =
    type === 'VP8 '
      ? vp8
      : type === 'VP8L'
        ? 'VP8L' + String.fromCharCode(5, 0, 0, 0, 0x2f, 6, 0, 1, 0, 0)
        : 'VP8X' + String.fromCharCode(10, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 4, 0, 0) + vp8
  return btoa('RIFF' + String.fromCharCode(payload.length + 4, 0, 0, 0) + 'WEBP' + payload)
}

afterEach(() => vi.unstubAllGlobals())

it('checks MIME, bounded dimensions and the GIF first frame before decode', async () => {
  expect(imagePixelCount('image/png', png(4096, 4096))).toBe(16_777_216)
  expect(imagePixelCount('image/jpeg', jpeg())).toBe(35)
  expect(imagePixelCount('image/gif', gif(8, 7))).toBe(64)
  for (const type of ['VP8 ', 'VP8L', 'VP8X'] as const)
    expect(imagePixelCount('image/webp', webp(type))).toBe(35)

  const decode = vi.fn()
  vi.stubGlobal('createImageBitmap', decode)
  for (const [mime, data] of [
    ['image/png', png(16_777_217, 1)],
    ['image/png', png(0, 100)],
    ['image/png', '%%%'],
    ['image/jpeg', png(32, 32)],
    ['image/gif', gif(8, 9)]
  ]) {
    expect(await imageThumbnail(mime, data)).toBeNull()
  }
  expect(decode).not.toHaveBeenCalled()
})

it('closes the bitmap after JPEG encoding succeeds or fails', async () => {
  const close = vi.fn()
  const drawImage = vi.fn()
  const encode = vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' }))
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 512, height: 256, close }))
  )
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        readonly width: number,
        readonly height: number
      ) {}
      getContext(): { drawImage: typeof drawImage } {
        return { drawImage }
      }
      convertToBlob = encode
    }
  )
  const data = png(512, 256)
  expect(await imageThumbnail('image/png', data)).toBe('data:image/jpeg;base64,anBlZw==')
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 256, 128)
  expect(encode).toHaveBeenCalledExactlyOnceWith({ type: 'image/jpeg', quality: 0.8 })
  expect(close).toHaveBeenCalledOnce()
  encode.mockRejectedValueOnce(new Error('encode error'))
  await expect(imageThumbnail('image/png', data)).rejects.toThrow('encode error')
  expect(close).toHaveBeenCalledTimes(2)
})

it('rejects a JPEG whose dimensions are beyond the header inspection limit', async () => {
  const segment = '\xff\xe1\xff\xff' + 'x'.repeat(65_533)
  const data = btoa('\xff\xd8' + segment.repeat(4) + atob(jpeg()).slice(2))
  const decode = vi.fn()
  vi.stubGlobal('createImageBitmap', decode)
  expect(await imageThumbnail('image/jpeg', data)).toBeNull()
  expect(decode).not.toHaveBeenCalled()
})
