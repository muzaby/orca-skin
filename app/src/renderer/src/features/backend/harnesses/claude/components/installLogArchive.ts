const VISUAL_ROW_CHARS = 160

export interface InstallLogRow {
  offset: number
  text: string
}

export class InstallLogArchive {
  readonly rows: InstallLogRow[] = []
  private offset = 0
  private tail: InstallLogRow | undefined

  append(output: string): void {
    let cursor = 0
    let newline = output.indexOf('\n')
    while (cursor < output.length) {
      if (!this.tail) {
        this.tail = { offset: this.offset, text: '' }
        this.rows.push(this.tail)
      }
      const available = VISUAL_ROW_CHARS - this.tail.text.length
      const limit = Math.min(output.length, cursor + available)
      let end = newline >= 0 && newline < limit ? newline + 1 : limit
      // Keep a surrogate pair together when a visual row falls between its code units.
      if (end < output.length && (output.charCodeAt(end) & 0xfc00) === 0xdc00) end--
      if (end === cursor) {
        this.tail = undefined
        continue
      }
      this.tail.text += output.slice(cursor, end)
      this.offset += end - cursor
      if (this.tail.text.length >= VISUAL_ROW_CHARS || output[end - 1] === '\n') {
        this.tail = undefined
      }
      if (newline >= 0 && end > newline) newline = output.indexOf('\n', end)
      cursor = end
    }
  }
}
