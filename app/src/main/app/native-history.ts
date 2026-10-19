import type { ChatActivitySnapshot, LoadedSession } from '../../shared/ipc'
import { restoreRecoveryResult } from '../features/history/native-recovery'
import { refreshNativeHistory } from '../features/history/native-sync'
import { parseAgentKind } from '../../shared/agent-kind'
import { resolveTurnProvider } from './chat-turn/resolve-turn'
import type { RouterContext } from './context'

export function nativeHistoryBusy(activity: ChatActivitySnapshot): boolean {
  return (
    activity.foreground !== 'idle' ||
    activity.transport === 'listening' ||
    activity.queuedCount > 0 ||
    activity.deliveryPendingCount > 0 ||
    activity.residualCount > 0 ||
    activity.backgroundTaskCount > 0 ||
    !!activity.pendingSessionWakeup ||
    (activity.sessionSchedules?.length ?? 0) > 0
  )
}

export function createNativeHistoryRefresh(
  ctx: RouterContext,
  runtime: {
    hasSession(sessionId: string): boolean
    discardRuntime(sessionId: string): unknown
    activity(sessionId: string): ChatActivitySnapshot
  }
): (sessionId: string) => Promise<LoadedSession['nativeSync']> {
  return async (sessionId) => {
    const meta = ctx.db.getSessionById(sessionId)
    if (!meta) return undefined
    const adapter = ctx.registry.get(meta.backend)
    if (!adapter?.readHistory) return undefined
    return refreshNativeHistory(sessionId, {
      db: ctx.db,
      isBusy: () => runtime.hasSession(sessionId) || nativeHistoryBusy(runtime.activity(sessionId)),
      releaseIdleRuntime: () => {
        runtime.discardRuntime(sessionId)
      },
      read: async (previous) => {
        const { prepared } = await resolveTurnProvider(ctx, {
          adapter,
          agentKind: parseAgentKind(meta.agent_kind),
          sessionId,
          providerKey: meta.provider_key,
          modelFamily: null
        })
        const recovery = ctx.db.nativeHistory?.recovery?.(sessionId)
        const result = await adapter.readHistory!({
          sessionId: recovery?.native_id ?? sessionId,
          previous: previous
            ? {
                ...previous,
                snapshot: { ...previous.snapshot, sessionId: recovery?.native_id ?? sessionId }
              }
            : undefined,
          cwd: meta.cwd ?? ctx.getCwd(meta.project_id),
          env: prepared.env,
          providerSettings: prepared.providerSettings
        })
        return restoreRecoveryResult(result, sessionId, recovery)
      }
    })
  }
}
