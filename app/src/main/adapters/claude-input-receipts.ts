import { randomUUID } from 'node:crypto'
import type { NormalizedEvent } from '../../shared/ipc'
import { isRecord } from '../../shared/obj'
import type { TurnInputContent } from './streaming-input'

type InputEvent = Extract<NormalizedEvent, { type: 'input.echo' | 'input.received' }>
type Receipt = { text: string; uuid: string }

// SDK 0.3.220의 Mz/MHm: 문자열 묶음은 LF로 결합, 블록 묶음은 text만 LF로 결합 후 trim.
function hookText(contents: TurnInputContent[]): string {
  if (contents.every((content) => typeof content === 'string')) return contents.join('\n')
  return contents
    .flatMap((content) =>
      typeof content === 'string'
        ? [content]
        : content.filter((part) => part.type === 'text').map((part) => part.text)
    )
    .join('\n')
    .trim()
}

/** user wire를 숨기는 SDK 자동 입력을 hook로 보존하되 앱 송신/중복 wire와 합류한다. */
export class ClaudeInputReceipts {
  private own: { content: TurnInputContent; uuid?: string; echoed: boolean }[] = []
  private pending: Receipt[] = []
  private emitted: Receipt[] = []
  private closed = false

  submitted(content: TurnInputContent, uuid?: string): void {
    if (!this.closed) this.own.push({ content, uuid, echoed: false })
  }

  prompt(input: unknown): void {
    if (this.closed || !isRecord(input) || typeof input.prompt !== 'string') return
    const prompt = input.prompt
    for (let count = this.own.length; count > 0; count -= 1) {
      if (hookText(this.own.slice(0, count).map((entry) => entry.content)) === prompt) {
        this.own.splice(0, count)
        return
      }
    }
    if (prompt.trim() !== '') this.pending.push({ text: prompt, uuid: randomUUID() })
  }

  reconcile(event: InputEvent): InputEvent | undefined {
    if (event.type === 'input.echo') {
      const own = this.own.find((entry) => event.uuid !== undefined && entry.uuid === event.uuid)
      if (own) own.echoed = true
    }
    const pending = this.pending.findIndex((entry) => entry.text === event.text)
    if (pending !== -1) {
      const receipt = this.pending.splice(pending, 1)[0]
      return event.type === 'input.received'
        ? event
        : {
            type: 'input.received',
            sessionId: event.sessionId,
            text: event.text,
            uuid: event.uuid ?? receipt.uuid,
            origin: { kind: 'automatic' }
          }
    }
    if (event.type === 'input.received') {
      const emitted = this.emitted.findIndex((entry) => entry.text === event.text)
      if (emitted !== -1) {
        this.emitted.splice(emitted, 1)
        return undefined
      }
    }
    return event
  }

  drain(sessionId: string): NormalizedEvent[] {
    if (sessionId === '' || this.closed) return []
    this.own = this.own.filter((entry) => !entry.echoed)
    const receipts = this.pending.splice(0)
    this.emitted.push(...receipts)
    if (this.emitted.length > 128) this.emitted.splice(0, this.emitted.length - 128)
    return receipts.map((receipt) => ({
      type: 'input.received',
      sessionId,
      ...receipt,
      origin: { kind: 'automatic' }
    }))
  }

  finishResponse(): void {
    // 텍스트 상관은 현재 응답 안의 늦은 wire에만 유효하다. 다음 응답의 동일 본문은 새 입력이다.
    this.emitted = []
    this.own = this.own.filter((entry) => !entry.echoed)
  }

  close(): void {
    this.closed = true
    this.own = []
    this.pending = []
    this.emitted = []
  }
}
