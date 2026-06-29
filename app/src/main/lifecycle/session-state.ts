export type SessionRuntimeState = 'cold' | 'live' | 'busy' | 'interrupting' | 'error' | 'closed'
export type AbortCause = 'user_cancelled' | 'stall' | 'retry' | null

export class SessionRuntimeStatus {
  private currentState: SessionRuntimeState = 'cold'
  private currentAbortCause: AbortCause = null

  get state(): SessionRuntimeState {
    return this.currentState
  }

  get abortCause(): AbortCause {
    return this.currentAbortCause
  }

  get cancelled(): boolean {
    return this.currentAbortCause === 'user_cancelled'
  }

  get timedOut(): boolean {
    return this.currentAbortCause === 'stall'
  }

  beginSend(): void {
    if (this.currentState === 'closed') return
    this.currentAbortCause = null
    this.currentState = 'busy'
  }

  markLive(): void {
    if (this.currentState === 'closed') return
    this.currentState = 'live'
  }

  markInterrupting(cause: Exclude<AbortCause, null>): void {
    if (this.currentState === 'closed') return
    this.currentAbortCause = cause
    this.currentState = 'interrupting'
  }

  markError(cause: Exclude<AbortCause, null> | null = null): void {
    if (this.currentState === 'closed') return
    this.currentAbortCause = cause
    this.currentState = 'error'
  }

  close(): void {
    this.currentState = 'closed'
  }
}
