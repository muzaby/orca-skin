// Keep the public string intact. Consumers of a hydrated part can read a small range
// without flattening the string that represents the entire message in V8.
export class ChunkedText {
  private readonly pieces: { start: number; text: string }[] = []
  length = 0
  hasContent = false

  append(text: string): void {
    if (!text.length) return
    this.pieces.push({ start: this.length, text })
    this.length += text.length
    this.hasContent ||= /\S/u.test(text)
  }

  slice(start: number, end: number): string {
    let lo = 0
    let hi = this.pieces.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.pieces[mid].start + this.pieces[mid].text.length <= start) lo = mid + 1
      else hi = mid
    }
    let text = ''
    for (let i = lo; i < this.pieces.length && this.pieces[i].start < end; i++) {
      const part = this.pieces[i]
      text += part.text.slice(Math.max(0, start - part.start), end - part.start)
    }
    return text
  }
}

export const wireTextFor = new WeakMap<object, ChunkedText>()

// Sender-local access for opening a pre-indexed source. The function never crosses the port.
export const readWireText = new WeakMap<object, (start: number, end: number) => string>()
