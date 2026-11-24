import { decodeImageBase64, imagePixelCount, IMAGE_MAX_PIXELS } from '../imageHeader'

const THUMBNAIL_MAX_SIDE = 256

export async function imageThumbnail(mimeType: string, data: string): Promise<string | null> {
  if (imagePixelCount(mimeType, data) === null) return null
  const bytes = decodeImageBase64(data)
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }))
  try {
    if (bitmap.width > Math.floor(IMAGE_MAX_PIXELS / bitmap.height)) return null
    const scale = Math.min(1, THUMBNAIL_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
    if (jpeg.type !== 'image/jpeg') return null
    const thumbnail = new Uint8Array(await jpeg.arrayBuffer())
    return 'data:image/jpeg;base64,' + btoa(String.fromCharCode(...thumbnail))
  } finally {
    bitmap.close()
  }
}
