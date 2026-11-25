import type { HistoryMetadataRef } from '../../../../../shared/history-page'
import type { LoadedSession } from '../../../../../shared/ipc'
import type { ChatState } from '../reducer/chatReducer'
import { sessionApi } from '../../../shared/api/ipc'

export async function readHistoryMetadata(
  ref: HistoryMetadataRef,
  openGeneration: number,
  current: () => boolean
): Promise<Omit<LoadedSession, 'messages'> | undefined> {
  const bytes = new Uint8Array(ref.bytes)
  let offset = 0
  while (offset < ref.bytes && current()) {
    const reply = await sessionApi.page({
      sessionId: ref.session,
      openGeneration,
      kind: 'metadata',
      ref,
      offset
    })
    if (reply.status !== 'metadata' || !current()) return
    const block = Uint8Array.from(atob(reply.base64), (c) => c.charCodeAt(0))
    if (offset + block.length !== reply.nextOffset || reply.nextOffset > ref.bytes) return
    bytes.set(block, offset)
    offset = reply.nextOffset
  }
  if (!current() || offset !== ref.bytes) return
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (value?.id === ref.session && (value.backend === 'claude' || value.backend === 'opencode'))
    return value
  return undefined
}

// A delayed metadata read may complete after a rename, a directory edit or a new turn.
export function restoreMetadata(
  state: ChatState,
  initial: ChatState,
  value: Omit<LoadedSession, 'messages'>
): ChatState {
  const next = { ...state }
  if (state.title === initial.title) next.title = value.title
  if (state.cwd === initial.cwd) next.cwd = value.cwd ?? null
  if (state.extraDirs === initial.extraDirs && value.extraDirs) next.extraDirs = value.extraDirs
  if (state.modelFamily === initial.modelFamily && value.modelFamily !== undefined)
    next.modelFamily = value.modelFamily
  if (state.providerKey === initial.providerKey && value.providerKey !== undefined)
    next.providerKey = value.providerKey
  if (state.projectId === initial.projectId && value.projectId !== undefined)
    next.projectId = value.projectId
  if (state.lastTelemetry === initial.lastTelemetry && value.lastTelemetry) {
    next.lastTelemetry = value.lastTelemetry
    next.lastTelemetryProviderKey = value.providerKey ?? null
  }
  if (state.worktree === initial.worktree && value.worktree) next.worktree = value.worktree
  if (value.lineage && state.lineageParentTitle === initial.lineageParentTitle) {
    next.lineageParentTitle = value.lineage.parentTitle
    if (value.lineage.relation === 'fork') next.forkFrom = value.lineage.parentSessionId
    else next.handoffFrom = value.lineage.parentSessionId
  }
  if (state.activity.revision === value.activity?.revision && value.activity?.sessionSchedules)
    next.sessionSchedules = value.activity.sessionSchedules
  return next
}
