// 페이로드 해석 — "이 send 는 무슨 턴인가" (0179 에서 분해).
//
// continuity 검증부터 provider/env/세션 메타/실제 텍스트까지, **TurnContext 를 짓기 전에
// 확정해야 하는 것들**을 한 단위로 모은다. 각 조각이 서로를 참조하기 때문이다 — continuity
// 메타가 provider 폴백과 cwd 계승과 제목 마커 언어를 동시에 정한다.

import type { WebContents } from 'electron'
import type { ClassifiedError } from '../../../shared/ipc'
import { continuityLangFor, type ContinuityLang } from '../../../shared/continuity-lang'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import { buildHandoffMessage } from '../../features/orchestration/handoff'
import { recoverSessionHistory } from '../../features/chat/recovery'
import type { RuntimeSupervisor } from '../../features/sessions/supervisor'
import { checkContinuitySource } from './admission'
import { buildTurnEnv, resolveTurnProvider, type ResolvedTurnProvider } from './turn-setup'
import type { SendChatPayload } from './admission'
import type { RouterContext } from '../context'
import type { ContinuitySourceMeta } from './turn-context'

export interface ResolvedTurn {
  continuitySource: string | undefined
  continuityMeta: ContinuitySourceMeta | undefined
  continuityLang: ContinuityLang
  resolved: ResolvedTurnProvider
  turnEnv: Record<string, string> | undefined
  sessionMeta:
    { cwd: string | null; project_id: string | null; provider_key?: string | null } | undefined
  boundProjectId: string | null
  /** handoff 면 main 이 조립한 자동 메시지, 아니면 사용자 입력 그대로. */
  effectiveText: string
}

export async function resolveTurn(
  ctx: RouterContext,
  supervisor: RuntimeSupervisor<WebContents>,
  adapter: RuntimeSessionAdapter,
  payload: SendChatPayload
): Promise<{ ok: true; value: ResolvedTurn } | { ok: false; error: ClassifiedError }> {
  const continuitySource = payload.forkFrom ?? payload.handoffFrom
  const continuityMeta = continuitySource ? ctx.db.getSessionById(continuitySource) : undefined
  const continuityError = checkContinuitySource({
    source: continuitySource,
    sourceExists: continuityMeta != null,
    isHandoff: payload.handoffFrom != null,
    // handoff 가드(mid-turn 거부) — 렌더러 비활성 가드의 main 측 이중 방어. fork 는 원본이
    // 불변이라 진행 중이어도 허용한다(plan 파생 UX).
    sourceHasLiveTurn: payload.handoffFrom != null && supervisor.hasSession(payload.handoffFrom)
  })
  if (continuityError) return { ok: false, error: continuityError }

  const resolved = await resolveTurnProvider(ctx, {
    adapter,
    sessionId: payload.sessionId,
    // fork/handoff 는 출발 세션의 마지막 provider 를 계승한다(명시 선택이 우선).
    providerKey: payload.providerKey ?? continuityMeta?.provider_key ?? null,
    modelFamily: payload.modelFamily ?? null
  })
  const sessionMeta = payload.sessionId ? ctx.db.getSessionById(payload.sessionId) : undefined

  // 0127 — continuity 산출물(제목 마커·자동 메시지) 언어: renderer draft 생성 시점 스냅샷
  // (payload continuityLang) 우선, 부재 시 settings.language(선호 언어) 파생 폴백.
  // settingsLanguage 원문은 en 템플릿의 요약 언어 지시({language}) 보간에도 쓴다.
  const settingsLanguage = continuitySource ? ctx.settings.getAll().language : undefined
  const continuityLang = payload.continuityLang ?? continuityLangFor(settingsLanguage)

  if (payload.sessionId) {
    recoverSessionHistory(ctx.db, {
      sessionId: payload.sessionId,
      isSessionLive: (sessionId) => supervisor.hasSession(sessionId)
    })
  }

  return {
    ok: true,
    value: {
      continuitySource,
      continuityMeta,
      continuityLang,
      resolved,
      // orca.json 앱 전역 env(${VAR} 확장)만 SDK subprocess env 로 병합한다.
      turnEnv: buildTurnEnv(ctx),
      sessionMeta,
      boundProjectId: payload.sessionId
        ? (sessionMeta?.project_id ?? null)
        : (continuityMeta?.project_id ?? payload.projectId),
      // handoff 는 main 이 자동 메시지를 조립해 text 를 대체한다(템플릿 단일 출처 = orchestration/).
      effectiveText: payload.handoffFrom
        ? buildHandoffMessage(
            continuityMeta?.title ?? null,
            payload.handoffFrom,
            continuityLang,
            settingsLanguage
          )
        : payload.text
    }
  }
}
