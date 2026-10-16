import type { Event } from '@opencode-ai/sdk/v2'
import type { NormalizedEvent } from '../../../../shared/ipc'
import { withReceivedInputFormat } from '../../../../shared/received-input'

/** Channel receipts, separate from the response mapper's idle/usage boundary. */
export class OpenCodeNativeInputs {
  private readonly users = new Set<string>()
  private readonly prompts = new Set<string>()
  private readonly parts = new Set<string>()
  private readonly retiredUsers = new Set<string>()
  private since: number | undefined

  constructor(
    private readonly sessionId: string,
    promptId: string
  ) {
    this.acceptPrompt(promptId)
  }

  acceptPrompt(id: string, retire = false): void {
    if (retire) this.retireUsers()
    this.prompts.add(id)
    this.users.add(id)
  }

  observe(event: Event, responseEnded = false): { events: NormalizedEvent[]; userId?: string } {
    if (!('sessionID' in event.properties) || event.properties.sessionID !== this.sessionId)
      return { events: [] }
    if (event.type === 'message.updated') {
      const info = event.properties.info
      if (
        info.role !== 'user' ||
        info.sessionID !== this.sessionId ||
        this.retiredUsers.has(info.id)
      )
        return { events: [] }
      if (this.prompts.has(info.id) && this.users.has(info.id)) this.since = info.time.created
      if (!this.users.has(info.id) && (this.since === undefined || info.time.created < this.since))
        return { events: [] }
      const fresh = !this.users.has(info.id)
      if (responseEnded && !fresh) return { events: [] }
      if (responseEnded) this.retireUsers()
      this.since = Math.max(this.since ?? info.time.created, info.time.created)
      this.users.add(info.id)
      return { events: [], ...(fresh ? { userId: info.id } : {}) }
    }
    if (event.type !== 'message.part.updated') return { events: [] }
    const part = event.properties.part
    if (
      responseEnded ||
      part.sessionID !== this.sessionId ||
      part.type !== 'text' ||
      !part.synthetic ||
      part.ignored ||
      !part.text ||
      !this.users.has(part.messageID) ||
      this.parts.has(part.id)
    )
      return { events: [] }
    this.parts.add(part.id)
    return {
      events: [
        {
          type: 'input.received',
          sessionId: this.sessionId,
          text: part.text,
          uuid: part.id,
          origin: withReceivedInputFormat(part.text, { kind: 'automatic' })
        }
      ]
    }
  }

  private retireUsers(): void {
    for (const id of this.users) this.retiredUsers.add(id)
    this.users.clear()
  }
}

/** Only call after native synthetic provenance and session ownership are established. */
export function nativeTaskCompletion(
  text: string
): { id: string; status: 'completed' | 'error' } | undefined {
  const match =
    /^\s*<task id="([^"<>]+)" state="(completed|error)">[\s\S]*<\/(?:task_result|task_error)>\s*<\/task>\s*$/.exec(
      text
    )
  return match ? { id: match[1], status: match[2] as 'completed' | 'error' } : undefined
}
