import type { TurnContext } from './turn-context'

export class SessionRuntimeRegistry<W = unknown, T extends TurnContext<W> = TurnContext<W>> {
  private readonly bySession = new Map<string, T>()
  private readonly pendingByOwner = new Map<W, T>()

  constructor(private readonly maxIdleRuntimes: number | null = null) {}

  getBySession(sessionId: string): T | undefined {
    return this.bySession.get(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.bySession.has(sessionId)
  }

  hasPending(owner: W): boolean {
    return this.pendingByOwner.has(owner)
  }

  startResume(sessionId: string, turn: T): void {
    this.bySession.set(sessionId, turn)
  }

  startNew(owner: W, turn: T): void {
    this.pendingByOwner.set(owner, turn)
  }

  promote(turn: T, sessionId: string): void {
    if (this.pendingByOwner.get(turn.owner) !== turn) return
    this.pendingByOwner.delete(turn.owner)
    this.bySession.set(sessionId, turn)
  }

  finish(turn: T): void {
    for (const [k, v] of this.bySession) {
      if (v === turn) this.bySession.delete(k)
    }
    for (const [k, v] of this.pendingByOwner) {
      if (v === turn) this.pendingByOwner.delete(k)
    }
  }

  all(): T[] {
    return [...this.bySession.values(), ...this.pendingByOwner.values()]
  }

  evictIdle(): T[] {
    void this.maxIdleRuntimes
    return []
  }

  get size(): number {
    return this.bySession.size + this.pendingByOwner.size
  }
}

export { SessionRuntimeRegistry as TurnRegistry }
