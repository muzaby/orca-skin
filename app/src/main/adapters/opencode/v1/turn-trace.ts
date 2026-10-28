import type { Event } from '@opencode-ai/sdk/v2/client'
import { randomUUID } from 'node:crypto'
import { retentionTrace } from './retention-trace'

/** Correlates only the current submitted parent; native message IDs never enter logs. */
export class OpenCodeTurnTrace {
  private turn = randomUUID()
  private started = Date.now()
  private prompt?: string
  private session?: string
  private assistant?: string
  private accepted = false
  private firstPart = false

  start(): void {
    this.turn = randomUUID()
    this.started = Date.now()
    this.prompt = this.session = this.assistant = undefined
    this.accepted = this.firstPart = false
  }
  bind(session: string, prompt: string): void {
    this.session = session
    this.prompt = prompt
  }
  accept(): void {
    if (this.accepted) return
    this.accepted = true
    this.emit('turn.prompt-accepted')
  }
  observe(event: Event): void {
    if (event.type === 'message.updated') {
      const info = event.properties.info
      if (
        info.role !== 'assistant' ||
        info.sessionID !== this.session ||
        info.parentID !== this.prompt
      )
        return
      // /command responds only after completion. Its first assistant event also proves acceptance.
      this.accept()
      if (!this.assistant) {
        this.assistant = info.id
        this.emit('turn.assistant-created')
      }
    }
    if (event.type === 'message.part.updated') {
      const part = event.properties.part
      if (
        !this.firstPart &&
        this.assistant &&
        part.sessionID === this.session &&
        part.messageID === this.assistant
      ) {
        this.firstPart = true
        this.emit('turn.first-part')
      }
    }
  }
  private emit(event: string): void {
    retentionTrace(event, { turn: this.turn, ms: Date.now() - this.started })
  }
}
