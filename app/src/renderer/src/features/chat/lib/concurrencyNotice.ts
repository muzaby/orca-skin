import type { ActiveTurnRef, WorktreeDisplay } from '../../../../../shared/ipc'

export function ownTurnIdentity(entry?: {
  session: { sessionId: string | null }
  clientKey?: string
}): ActiveTurnRef {
  return {
    sessionId: entry?.session.sessionId ?? null,
    clientKey: entry?.clientKey ?? null
  }
}

export function isOwnTurn(ref: ActiveTurnRef, own: ActiveTurnRef): boolean {
  return (
    (ref.sessionId !== null && ref.sessionId === own.sessionId) ||
    (ref.clientKey !== null && ref.clientKey === own.clientKey)
  )
}

export function otherProjectTurns(refs: readonly ActiveTurnRef[], own: ActiveTurnRef): number {
  return refs.filter((ref) => !isOwnTurn(ref, own)).length
}

export function displayedSessionIsolated(session?: {
  worktree: WorktreeDisplay | null
  worktreeIsolation: boolean
}): boolean {
  return session?.worktree != null || session?.worktreeIsolation === true
}
