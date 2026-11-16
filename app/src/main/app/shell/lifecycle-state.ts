// 셸이 아는 턴·세션 상태 (0324 EP-11 · MD-06). 에이전트 호스트가 보낸 수명 이벤트로만 만든다 —
// 셸은 턴 런타임을 직접 보지 않는다. 업데이트 재시작 게이트와 트레이 종료 판정이 이 상태를 본다.

import type { LifecycleEvent } from '../../../shared/host-protocol'

export class LifecycleState {
  private readonly active = new Set<string>()
  private readonly awaitingApproval = new Set<string>()
  private readonly failed = new Set<string>()
  private readonly listeners = new Set<() => void>()

  apply(event: LifecycleEvent): void {
    const { sessionId } = event
    switch (event.type) {
      case 'turn.started':
        this.failed.delete(sessionId)
        if (!this.active.has(sessionId)) this.changed(() => this.active.add(sessionId))
        return
      case 'turn.ended':
        // 모르는 세션의 종료는 변화가 없다.
        if (!this.active.has(sessionId) && !this.awaitingApproval.has(sessionId)) return
        this.changed(() => {
          this.active.delete(sessionId)
          this.awaitingApproval.delete(sessionId)
        })
        return
      case 'approval.pending':
        if (!this.awaitingApproval.has(sessionId)) {
          this.changed(() => this.awaitingApproval.add(sessionId))
        }
        return
      case 'session.ended':
        if (!this.knows(sessionId)) return
        this.changed(() => {
          this.active.delete(sessionId)
          this.awaitingApproval.delete(sessionId)
          this.failed.delete(sessionId)
        })
        return
      case 'harness.exited':
        this.changed(() => {
          this.active.delete(sessionId)
          this.awaitingApproval.delete(sessionId)
          this.failed.add(sessionId)
        })
        return
    }
  }

  // 에이전트 호스트가 죽었다 — 그 호스트의 턴은 모두 사라졌다.
  clear(): void {
    if (this.active.size + this.awaitingApproval.size + this.failed.size === 0) return
    this.changed(() => {
      this.active.clear()
      this.awaitingApproval.clear()
      this.failed.clear()
    })
  }

  activeTurnCount(): number {
    return this.active.size
  }

  hasActiveTurns(): boolean {
    return this.active.size > 0
  }

  isActive(sessionId: string): boolean {
    return this.active.has(sessionId)
  }

  isAwaitingApproval(sessionId: string): boolean {
    return this.awaitingApproval.has(sessionId)
  }

  // 하네스가 끊겨 오류로 끝난 세션인가. 그 세션의 다음 턴이 시작되면 지워진다.
  hasFailed(sessionId: string): boolean {
    return this.failed.has(sessionId)
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private knows(sessionId: string): boolean {
    return (
      this.active.has(sessionId) ||
      this.awaitingApproval.has(sessionId) ||
      this.failed.has(sessionId)
    )
  }

  private changed(mutate: () => void): void {
    mutate()
    for (const listener of [...this.listeners]) listener()
  }
}
