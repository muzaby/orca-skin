// Electron's Chromium supports this native decoder before the application's TypeScript lib declares it.
export function decodeImageBase64(value: string): Uint8Array<ArrayBuffer> {
  const constructor = Uint8Array as typeof Uint8Array & {
    fromBase64?(value: string): Uint8Array<ArrayBuffer>
  }
  if (constructor.fromBase64) return constructor.fromBase64(value)
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

export const IMAGE_MAX_PIXELS = 16_777_216
const IMAGE_HEADER_BYTES = 256 * 1024

interface Dimensions {
  width: number
  height: number
}

function withinBudget(
  width: number,
  height: number,
  maxWidth = IMAGE_MAX_PIXELS,
  maxHeight = IMAGE_MAX_PIXELS
): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= maxWidth &&
    height <= maxHeight &&
    width <= Math.floor(IMAGE_MAX_PIXELS / height)
  )
}

function jpegDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (view.getUint16(0) !== 0xffd8) return null
  for (let cursor = 2; cursor + 4 <= bytes.length;) {
    if (bytes[cursor++] !== 0xff) return null
    while (bytes[cursor] === 0xff) cursor++
    const marker = bytes[cursor++]
    if (marker === 0xda || marker === 0xd9 || cursor + 2 > bytes.length) return null
    const size = view.getUint16(cursor)
    if (size < 2 || cursor + size > bytes.length) return null
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (size < 8) return null
      return { width: view.getUint16(cursor + 5), height: view.getUint16(cursor + 3) }
    }
    cursor += size
  }
  return null
}

function gifDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (view.getUint32(0) !== 0x47494638 || ![0x3761, 0x3961].includes(view.getUint16(4))) return null
  const width = view.getUint16(6, true)
  const height = view.getUint16(8, true)
  const packed = bytes[10]
  let cursor = 13 + ((packed & 0x80) !== 0 ? 3 * (2 << (packed & 7)) : 0)
  while (cursor < bytes.length) {
    const type = bytes[cursor++]
    if (type === 0x2c && cursor + 9 <= bytes.length) {
      const left = view.getUint16(cursor, true)
      const top = view.getUint16(cursor + 2, true)
      const frameWidth = view.getUint16(cursor + 4, true)
      const frameHeight = view.getUint16(cursor + 6, true)
      return withinBudget(frameWidth, frameHeight, width - left, height - top)
        ? { width, height }
        : null
    }
    if (type !== 0x21) return null
    cursor++ // Extension label, followed by length-prefixed blocks.
    while (cursor < bytes.length) {
      const size = bytes[cursor++]
      if (!size) break
      cursor += size
    }
  }
  return null
}

function webpFrame(view: DataView, type: number, start: number, length: number): Dimensions | null {
  if (type === 0x56503820 && length >= 10 && start + 10 <= view.byteLength) {
    if (
      (view.getUint8(start) & 1) !== 0 ||
      view.getUint8(start + 3) !== 0x9d ||
      view.getUint16(start + 4) !== 0x012a
    )
      return null
    return {
      width: view.getUint16(start + 6, true) & 0x3fff,
      height: view.getUint16(start + 8, true) & 0x3fff
    }
  }
  if (
    type === 0x5650384c &&
    length >= 5 &&
    start + 5 <= view.byteLength &&
    view.getUint8(start) === 0x2f
  ) {
    const bits = view.getUint32(start + 1, true)
    if (bits >>> 29 !== 0) return null
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  return null
}

function uint24(view: DataView, offset: number): number {
  return view.getUint16(offset, true) + view.getUint8(offset + 2) * 65_536
}

function webpDimensions(view: DataView, byteLength: number): Dimensions | null {
  if (
    view.getUint32(0) !== 0x52494646 ||
    view.getUint32(8) !== 0x57454250 ||
    view.getUint32(4, true) + 8 !== byteLength
  )
    return null
  const type = view.getUint32(12)
  const length = view.getUint32(16, true)
  if (20 + length > byteLength) return null
  if (type !== 0x56503858) return webpFrame(view, type, 20, length)
  if (length !== 10 || view.byteLength < 30) return null
  const width = 1 + uint24(view, 24)
  const height = 1 + uint24(view, 27)
  if (!withinBudget(width, height)) return null
  const animated = (view.getUint8(20) & 2) !== 0
  for (let cursor = 30; cursor + 8 <= view.byteLength;) {
    const chunk = view.getUint32(cursor)
    const size = view.getUint32(cursor + 4, true)
    const start = cursor + 8
    if (start + size > byteLength) return null
    if (!animated && [0x56503820, 0x5650384c].includes(chunk)) {
      const frame = webpFrame(view, chunk, start, size)
      return frame?.width === width && frame.height === height ? { width, height } : null
    }
    if (animated && chunk === 0x414e4d46) {
      if (size < 16 || start + 16 > view.byteLength) return null
      const frameWidth = uint24(view, start + 6) + 1
      const frameHeight = uint24(view, start + 9) + 1
      if (
        !withinBudget(
          frameWidth,
          frameHeight,
          width - 2 * uint24(view, start),
          height - 2 * uint24(view, start + 3)
        )
      )
        return null
      for (let part = start + 16; part + 8 <= view.byteLength && part + 8 <= start + size;) {
        const frameType = view.getUint32(part)
        const frameLength = view.getUint32(part + 4, true)
        if (part + 8 + frameLength > start + size) return null
        if ([0x56503820, 0x5650384c].includes(frameType)) {
          const frame = webpFrame(view, frameType, part + 8, frameLength)
          return frame?.width === frameWidth && frame.height === frameHeight
            ? { width, height }
            : null
        }
        part += 8 + frameLength + (frameLength % 2)
      }
      return null
    }
    cursor = start + size + (size % 2)
  }
  return null
}

export function imagePixelCount(mimeType: string, base64: string): number | null {
  const prefixChars = Math.ceil(IMAGE_HEADER_BYTES / 3) * 4
  try {
    const bytes = decodeImageBase64(base64.slice(0, prefixChars)).subarray(0, IMAGE_HEADER_BYTES)
    if (bytes.length < 24) return null
    const view = new DataView(bytes.buffer, 0, bytes.byteLength)
    let dimensions: Dimensions | null = null
    switch (mimeType) {
      case 'image/png':
        if (
          view.getUint32(0) === 0x89504e47 &&
          view.getUint32(4) === 0x0d0a1a0a &&
          view.getUint32(8) === 13 &&
          view.getUint32(12) === 0x49484452
        )
          dimensions = { width: view.getUint32(16), height: view.getUint32(20) }
        break
      case 'image/jpeg':
        dimensions = jpegDimensions(bytes, view)
        break
      case 'image/gif':
        dimensions = gifDimensions(bytes, view)
        break
      case 'image/webp': {
        const byteLength =
          Math.floor((base64.length * 3) / 4) -
          (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
        dimensions = webpDimensions(view, byteLength)
        break
      }
    }
    return dimensions && withinBudget(dimensions.width, dimensions.height)
      ? dimensions.width * dimensions.height
      : null
  } catch {
    return null
  }
}
