export type SessionState = 'cold' | 'live' | 'busy' | 'interrupting' | 'error' | 'closed'

export type AbortCause = 'user_cancelled' | 'stall' | 'retry'

export type SessionStateEvent =
  | { type: 'open' }
  | { type: 'send.start' }
  | { type: 'send.terminal' }
  | { type: 'interrupt'; cause: AbortCause }
  | { type: 'error' }
  | { type: 'close' }

export interface SessionStateSnapshot {
  state: SessionState
  abortCause: AbortCause | null
}

export function initialSessionState(): SessionStateSnapshot {
  return { state: 'cold', abortCause: null }
}

export function transition(
  current: SessionStateSnapshot,
  event: SessionStateEvent
): SessionStateSnapshot {
  if (current.state === 'closed') return current
  switch (event.type) {
    case 'open':
      return { state: 'live', abortCause: null }
    case 'send.start':
      return { state: 'busy', abortCause: null }
    case 'send.terminal':
      return { state: 'live', abortCause: null }
    case 'interrupt':
      return { state: 'interrupting', abortCause: event.cause }
    case 'error':
      return { state: 'error', abortCause: current.abortCause }
    case 'close':
      return { state: 'closed', abortCause: current.abortCause }
  }
}

export function isTerminalEventType(type: string): boolean {
  return type === 'telemetry' || type === 'error' || type === 'turn.aborted'
}
