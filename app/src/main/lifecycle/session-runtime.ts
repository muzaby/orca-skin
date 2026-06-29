import type { NormalizedEvent } from '../../shared/ipc'
import type { ClaudePermissionMode } from '../../shared/permission-mode'
import type { TurnRequest } from '../extensions/types'
import type { ManagedRuntime, RuntimeLiveTurn, RuntimeSessionAdapter } from './ports'
import { SessionRuntimeStatus, type AbortCause, type SessionRuntimeState } from './session-state'

// close 정책 2종(decision ⑳) — streaming-input 메커니즘은 1개(아래 runAttempt)이고 close 정책만
// 파라미터화한다. oneshot = 턴 종료 시 핸들 폐기(매 턴 fresh), persistent = 턴을 넘어 idle 로 살아남아
// cross-turn 재사용(소유·회수는 Supervisor/RuntimePool, handoff 0054).
export type ClosePolicy = 'oneshot' | 'persistent'

const EMPTY_EVENTS: AsyncIterable<NormalizedEvent> = {
  [Symbol.asyncIterator](): AsyncIterator<NormalizedEvent> {
    return { next: async () => ({ done: true, value: undefined as never }) }
  }
}

function isTerminal(ev: NormalizedEvent): boolean {
  return ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted'
}

// SessionRuntime: send() 1회는 adapter attempt 1회다(retry 정책은 TurnCoordinator 가 소유). close
// 정책으로 파라미터화(decision ⑳) — 메커니즘은 동일하고, persistent 만 Supervisor/RuntimePool 에서
// 턴을 넘어 보존·재사용된다. 'reusable' 플래그가 그 보존 여부를 외부에 알린다(클래스 자신은 재사용
// 배선을 모른다 — 소유는 풀).
export class SessionRuntime implements ManagedRuntime {
  private readonly status = new SessionRuntimeStatus()
  private live: RuntimeLiveTurn | null = null

  constructor(
    private readonly adapter: RuntimeSessionAdapter,
    private readonly closePolicy: ClosePolicy = 'oneshot'
  ) {}

  // Persistent close 정책의 핸들만 idle 보존·cross-turn 재사용 대상이다(Supervisor.releaseRuntime
  // 이 이 플래그 + 종료 상태로 보존 여부를 판정). OneShot 은 항상 false → 턴 종료 시 즉시 close.
  get reusable(): boolean {
    return this.closePolicy === 'persistent'
  }

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

// 무회귀 alias — 기존 import 경로(OneShotSessionRuntime)를 유지한다. closePolicy 기본값이 'oneshot'
// 이므로 `new OneShotSessionRuntime(adapter)` 는 종전과 동일한 단발 핸들이다(0054 호환).
export const OneShotSessionRuntime = SessionRuntime
export type OneShotSessionRuntime = SessionRuntime
