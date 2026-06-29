import type { ClaudePermissionMode } from '../../shared/permission-mode'
import type { NormalizedEvent } from '../../shared/ipc'
import type { TurnRequest } from '../extensions/types'
import {
  initialSessionState,
  isTerminalEventType,
  transition,
  type AbortCause,
  type SessionStateSnapshot
} from './session-state'

export interface RuntimeLiveTurn {
  events: AsyncIterable<NormalizedEvent>
  setPermissionMode(mode: ClaudePermissionMode): Promise<void>
  interrupt(): Promise<void>
  setModel(model?: string): Promise<void>
  stopTask(taskId: string): Promise<void>
  backgroundTask(toolUseId: string): Promise<boolean>
  close(): void
}

export interface RuntimeAdapterPort {
  sendMessage(req: TurnRequest): RuntimeLiveTurn
}

export interface SessionRuntime {
  readonly state: SessionStateSnapshot
  send(req: TurnRequest): AsyncIterable<NormalizedEvent>
  interrupt(cause?: AbortCause): Promise<void>
  setMode(mode: ClaudePermissionMode): Promise<void>
  setModel(model?: string): Promise<void>
  stopTask(taskId: string): Promise<void>
  backgroundTask(toolUseId: string): Promise<boolean>
  push(content: unknown): void
  close(): void
}

export class OneShotSessionRuntime implements SessionRuntime {
  private snapshot = initialSessionState()
  private live: RuntimeLiveTurn | null = null

  constructor(private readonly adapter: RuntimeAdapterPort) {}

  get state(): SessionStateSnapshot {
    return this.snapshot
  }

  async *send(req: TurnRequest): AsyncIterable<NormalizedEvent> {
    this.snapshot = transition(this.snapshot, { type: 'send.start' })
    const live = this.adapter.sendMessage(req)
    this.live = live
    let sawTerminal = false
    try {
      for await (const ev of live.events) {
        if (isTerminalEventType(ev.type)) {
          sawTerminal = true
          this.snapshot = transition(this.snapshot, { type: 'send.terminal' })
          live.close()
        }
        yield ev
      }
    } catch (err) {
      this.snapshot = transition(this.snapshot, { type: 'error' })
      throw err
    } finally {
      if (!sawTerminal && this.snapshot.state === 'busy') {
        this.snapshot = transition(this.snapshot, { type: 'send.terminal' })
      }
      live.close()
      if (this.live === live) this.live = null
    }
  }

  async interrupt(cause: AbortCause = 'user_cancelled'): Promise<void> {
    this.snapshot = transition(this.snapshot, { type: 'interrupt', cause })
    await this.live?.interrupt()
  }

  async setMode(mode: ClaudePermissionMode): Promise<void> {
    await this.live?.setPermissionMode(mode)
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

  push(content: unknown): void {
    void content
    throw new Error('Persistent SessionRuntime push() is not implemented in P0')
  }

  close(): void {
    this.live?.close()
    this.snapshot = transition(this.snapshot, { type: 'close' })
  }
}
