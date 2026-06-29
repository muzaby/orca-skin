import type { NormalizedEvent } from '../../shared/ipc'
import type { ClaudePermissionMode } from '../../shared/permission-mode'
import type { TurnRequest } from '../extensions/types'
import type { RuntimeLiveTurn, RuntimeSessionAdapter } from './ports'
import { SessionRuntimeStatus, type AbortCause, type SessionRuntimeState } from './session-state'

const EMPTY_EVENTS: AsyncIterable<NormalizedEvent> = {
  [Symbol.asyncIterator](): AsyncIterator<NormalizedEvent> {
    return { next: async () => ({ done: true, value: undefined as never }) }
  }
}

function isTerminal(ev: NormalizedEvent): boolean {
  return ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted'
}

// P0 OneShot runtime: send() 1회는 adapter attempt 1회다. Retry 정책은 send.ts 가 유지한다.
export class OneShotSessionRuntime implements RuntimeLiveTurn {
  private readonly status = new SessionRuntimeStatus()
  private live: RuntimeLiveTurn | null = null

  constructor(private readonly adapter: RuntimeSessionAdapter) {}

  get events(): AsyncIterable<NormalizedEvent> {
    return this.live?.events ?? EMPTY_EVENTS
  }

  get state(): SessionRuntimeState {
    return this.status.state
  }

  get abortCause(): AbortCause {
    return this.status.abortCause
  }

  get cancelled(): boolean {
    return this.status.cancelled
  }

  get timedOut(): boolean {
    return this.status.timedOut
  }

  send(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    return this.runAttempt(req)
  }

  private async *runAttempt(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    this.status.beginSend()
    const live = this.adapter.sendMessage(req)
    this.live = live
    let terminal = false
    try {
      for await (const ev of live.events) {
        if (isTerminal(ev)) terminal = true
        yield ev
        if (terminal) {
          live.close()
          this.status.markLive()
        }
      }
      if (!terminal) this.status.markLive()
    } catch (err) {
      if (!this.cancelled && !this.timedOut) this.status.markError(null)
      throw err
    } finally {
      live.close()
      if (this.live === live) this.live = null
    }
  }

  close(): void {
    this.live?.close()
    this.live = null
    this.status.close()
  }

  markAborted(cause: Exclude<AbortCause, null>): void {
    this.status.markInterrupting(cause)
  }

  async setPermissionMode(mode: ClaudePermissionMode): Promise<void> {
    await this.live?.setPermissionMode(mode)
  }

  async interrupt(): Promise<void> {
    this.status.markInterrupting('user_cancelled')
    await this.live?.interrupt()
  }

  async setModel(model?: string): Promise<void> {
    await this.live?.setModel(model)
  }

  async stopTask(taskId: string): Promise<void> {
    await this.live?.stopTask(taskId)
  }

  async backgroundTask(toolUseId: string): Promise<boolean> {
    return (await this.live?.backgroundTask(toolUseId)) ?? false
  }
}
