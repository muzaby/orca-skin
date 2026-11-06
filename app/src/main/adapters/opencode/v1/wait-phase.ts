import type { SessionStatus } from '@opencode-ai/sdk/v2/client'
import type { ChatWaitPhase } from '../../../../shared/ipc'
import { isModelOutputEvent } from '../../../../shared/model-output'

function samePhase(a: ChatWaitPhase | null, b: ChatWaitPhase | null): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  return a.kind !== 'retry' || (b.kind === 'retry' && a.attempt === b.attempt)
}

export class OpenCodeWaitPhase {
  private current: ChatWaitPhase | null = null
  private outputObserved = false

  constructor(private readonly sink?: (phase: ChatWaitPhase | null) => void) {}

  serverStarting(): void {
    this.emit({ kind: 'server' })
  }

  connected(): void {
    this.emit({ kind: 'project' })
  }

  creatingSession(): void {
    this.emit({ kind: 'session' })
  }

  admitting(): void {
    this.emit({ kind: 'mcp' })
  }

  sending(): void {
    this.outputObserved = false
    this.emit({ kind: 'send' })
  }

  accepted(): void {
    if (this.current?.kind !== 'send' || this.outputObserved) return
    this.emit({ kind: 'model' })
  }

  status(status: SessionStatus): void {
    if (status.type === 'retry') {
      const attempt = Number.isInteger(status.attempt) && status.attempt >= 1 ? status.attempt : 1
      this.emit({ kind: 'retry', attempt })
      return
    }
    if (status.type === 'busy' && this.current?.kind === 'retry') {
      this.emit(this.outputObserved ? null : { kind: 'model' })
    }
  }

  observe(events: ReadonlyArray<{ type: string }>): void {
    if (events.some(isModelOutputEvent)) {
      this.outputObserved = true
      this.emit(null)
    }
  }

  end(): void {
    this.outputObserved = false
    this.emit(null)
  }

  private emit(next: ChatWaitPhase | null): void {
    if (samePhase(this.current, next)) return
    this.current = next
    this.sink?.(next)
  }
}
