// 세션 갱신의 하네스 원본 읽기 (0324 F4 · AC19′ — "갱신의 네이티브 이력 읽기는 에이전트 호스트가 한다").
//
// 기록(DB)은 데이터 호스트, 원본 읽기(하네스 어댑터)는 에이전트 호스트다. 데이터 호스트의 세션 갱신이
// 이 읽기를 `agent.call` 의 `readNativeHistory` 로 부탁한다. 세션 메타·복구 식별자·이전 스냅샷은
// 데이터 링크로 다시 읽는다 — 원본 레코드(`raw`)는 이어 읽기가 성립할 때만 묻는다.

import { parseAgentKind } from '../../shared/agent-kind'
import type { NativeHistoryResult } from '../adapters/common/native-history'
import { restoreRecoveryResult } from '../features/history/native-recovery'
import { resolveTurnProvider } from './chat-turn/resolve-turn'
import type { AgentContext } from './context'
import { sessionActivityBusy as nativeHistoryBusy } from './session-activity-busy'

export { nativeHistoryBusy }

// 읽을 수 없는 세션(행 없음 · 원본 읽기를 지원하지 않는 하네스)이면 `unchanged` — 갱신하지 않는다.
export function createNativeHistoryReader(
  ctx: AgentContext
): (sessionId: string) => Promise<NativeHistoryResult> {
  return async (sessionId) => {
    const meta = await ctx.data.query.getSessionById(sessionId)
    if (!meta) return { status: 'unchanged' }
    const adapter = ctx.registry.get(meta.backend)
    if (!adapter?.readHistory) return { status: 'unchanged' }
    const { prepared } = await resolveTurnProvider(ctx, {
      adapter,
      agentKind: parseAgentKind(meta.agent_kind),
      sessionId,
      providerKey: meta.provider_key,
      modelFamily: null
    })
    const [recovery, previous, workspace] = await Promise.all([
      ctx.data.query.nativeRecovery(sessionId),
      ctx.data.query.nativeHistoryPrevious(sessionId),
      meta.cwd ? undefined : ctx.data.query.workspacePaths([meta.project_id ?? null])
    ])
    const nativeId = recovery?.native_id ?? sessionId
    const result = await adapter.readHistory({
      sessionId: nativeId,
      previous: previous
        ? {
            snapshot: { ...previous.snapshot, sessionId: nativeId },
            ...(previous.cursor ? { cursor: previous.cursor } : {}),
            raw: () => ctx.data.query.nativeHistoryRaw(sessionId)
          }
        : undefined,
      cwd: meta.cwd ?? workspace?.[0]?.[1] ?? ctx.defaultCwd(),
      env: prepared.env,
      providerSettings: prepared.providerSettings
    })
    return restoreRecoveryResult(result, sessionId, recovery)
  }
}
