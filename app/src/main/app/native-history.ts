import type { ChatActivitySnapshot, LoadedSession } from '../../shared/ipc'
import { restoreRecoveryResult } from '../features/history/native-recovery'
import { refreshNativeHistory } from '../features/history/native-sync'
import { parseAgentKind } from '../../shared/agent-kind'
import { resolveTurnProvider } from './chat-turn/resolve-turn'
import type { RouterContext } from './context'
import { sessionActivityBusy as nativeHistoryBusy } from './session-activity-busy'

export { nativeHistoryBusy }

export function createNativeHistoryRefresh(
  ctx: RouterContext,
  runtime: {
    hasSession(sessionId: string): boolean
    hasRuntime(sessionId: string): boolean
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
      // Navigation must not close a warm provider channel or replace the history it owns.
      isBusy: () =>
        runtime.hasSession(sessionId) ||
        runtime.hasRuntime(sessionId) ||
        nativeHistoryBusy(runtime.activity(sessionId)),
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
