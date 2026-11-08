import type { ActiveTurnRef, ConcurrencyEvent } from '../../../shared/ipc'

// 응답 중인 비격리 세션의 신원. runtime cap/lease 회계와는 별개다.
export class ActiveTurnTracker {
  private readonly entries = new Map<object, { projectId: string; ref: ActiveTurnRef }>()

  constructor(private readonly onChange: (event: ConcurrencyEvent) => void = () => undefined) {}

  begin(token: object, projectId: string | null | undefined, ref: ActiveTurnRef): void {
    if (!projectId || this.entries.has(token)) return
    this.entries.set(token, { projectId, ref: { ...ref } })
    this.emit(projectId)
  }

  confirm(token: object, sessionId: string): void {
    const entry = this.entries.get(token)
    if (!entry || entry.ref.sessionId !== null) return
    entry.ref = { ...entry.ref, sessionId }
    this.emit(entry.projectId)
  }

  end(token: object): void {
    const entry = this.entries.get(token)
    if (!entry) return
    this.entries.delete(token)
    this.emit(entry.projectId)
  }

  turns(projectId: string | null | undefined): ActiveTurnRef[] {
    if (!projectId) return []
    return [...this.entries.values()]
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => ({ ...entry.ref }))
  }

  private emit(projectId: string): void {
    this.onChange({ projectId, turns: this.turns(projectId) })
  }
}
