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
import { appEnv } from '../../infra/config/orca-config'
import { expandEnvRecord, processEnvRecord } from '../../features/harnesses/env'
import {
  prepareHarnessConfig,
  prepareUnresolvedHarnessConfig,
  type PreparedHarnessConfig
} from '../../adapters/harness-config'
import {
  defaultProvider,
  defaultModelFamily,
  modelNameForFamily,
  resolveTitleModel,
  toAgentEnvironments
} from '../../features/harnesses/models'
import { SPAWN_ENV_INJECTOR } from '../deployment/spawn-env'
import { getLogger } from '../../infra/log'
import { makeClassifiedError } from '../../infra/errors'
import { resolveAgentKind } from '../../features/agents/profiles'
import type { SendChatPayload } from './admission'
import type { RouterContext } from '../context'
import type { ContinuitySourceMeta } from './turn-context'

interface ResolvedTurn {
  continuitySource: string | undefined
  continuityMeta: ContinuitySourceMeta | undefined
  continuityLang: ContinuityLang
  resolved: ResolvedTurnProvider
  sessionMeta:
    | {
        cwd: string | null
        project_id: string | null
        provider_key?: string | null
        extra_dirs?: string | null
      }
    | undefined
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
  let continuityMeta = continuitySource ? ctx.db.getSessionById(continuitySource) : undefined
  const sourceId = payload.sessionId ?? continuitySource
  const source = payload.sessionId ? ctx.db.getSessionById(payload.sessionId) : continuityMeta
  const identity = resolveAgentKind(payload.agentKind, source?.agent_kind)
  if ((sourceId && !source) || !identity.ok) {
    return {
      ok: false,
      error: makeClassifiedError(
        'schema_validation_error',
        '원본 대화가 없거나 대화의 작업 종류가 일치하지 않습니다.'
      )
    }
  }
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
  // provider 준비가 await한 사이 세션이 삭제/변경되면 오래된 출생 속성으로 실행하지 않는다.
  const currentSource = sourceId ? ctx.db.getSessionById(sourceId) : undefined
  if (
    sourceId &&
    (!currentSource || !resolveAgentKind(identity.kind, currentSource.agent_kind).ok)
  ) {
    return {
      ok: false,
      error: makeClassifiedError(
        'schema_validation_error',
        '준비 중 원본 대화가 삭제되었거나 작업 종류가 변경되었습니다.'
      )
    }
  }
  const sessionMeta = payload.sessionId ? currentSource : undefined
  if (continuitySource) continuityMeta = currentSource

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
      // env·settings·fingerprint 는 **한 벌로** 온다 (0188) — 별도 조립 지점을 두면 chat 과
      // title generation 이 서로 다른 스냅샷을 쓰게 된다.
      resolved,
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

export interface ResolvedTurnProvider {
  // 이 턴의 **spawn 입력 한 벌**. settings·env·fingerprint 가 함께 온다 — chat 과 title
  // generation 이 같은 스냅샷을 쓰게 하려면 셋이 갈라지면 안 된다(0188 D-019).
  prepared: PreparedHarnessConfig
  providerKey: string | null
  model?: string
  titleModel?: string
}

// 턴 단위 provider/model 해석 (handoff 0010 → 0014) — payload providerKey 가 어댑터와
// 일치하면 적용, 불일치/무효면 세션의 마지막 provider_key → 기본 provider(anthropic 우선) 폴백.
// 원천은 sources/settings/<adapter>/ 트리(HarnessSettingsService)이며, settings 해석(blob)은
// dist 캐시에서 가져온다. 비밀(secret-store 토큰·${VAR})은 해석기 내부에서만 평문화된다.
export async function resolveTurnProvider(
  ctx: RouterContext,
  req: {
    adapter: RuntimeSessionAdapter
    sessionId: string | null
    providerKey: string | null
    modelFamily: string | null
  }
): Promise<ResolvedTurnProvider> {
  const settings = toAgentEnvironments(ctx.harnessSettings.list(req.adapter.id), [req.adapter.id])
  const entries = (ctx.runtimeModelCatalog?.merge(settings, req.adapter.id) ?? settings).map(
    (entry) => ({
      key: entry.key,
      harnessId: entry.adapter,
      modelProviderId: entry.provider ?? entry.key,
      models: entry.models
    })
  )
  const meta = req.sessionId ? ctx.db.getSessionById(req.sessionId) : undefined
  const byKey = (key: string | null | undefined): (typeof entries)[number] | undefined =>
    key ? entries.find((entry) => entry.key === key) : undefined

  let selected = byKey(req.providerKey)
  if (req.sessionId && selected && selected.harnessId !== meta?.backend) {
    getLogger().child('providers').warn('providers.key.mismatch', {
      providerKey: req.providerKey,
      reason: 'adapter mismatch — falling back to session provider'
    })
    selected = undefined
  }
  if (req.sessionId && !selected) selected = byKey(meta?.provider_key)
  if (!selected) selected = defaultProvider(entries)
  if (!selected) return { providerKey: null, prepared: unresolvedPrepared(ctx) }

  // ── 실행 구성 해석은 **턴당 1회** (0188 D-019) ────────────────────────────────
  // settings 해석과 동적 보강(있으면)을 한 번에 끝내고, 그 결과로 spawn 입력을 조립한다.
  // 정적 구성에서는 augmenter 가 없으므로 network 접근이 0이고 기존 mtime stat 만 남는다.
  const entry = {
    key: selected.key,
    harnessId: selected.harnessId,
    modelProviderId: selected.modelProviderId
  }
  // 런타임 관리 key 는 Gate 인증 때 1회 fetch 한 cache 만 읽는다 (D-008) — 턴마다 network 금지.
  const config = ctx.harnessRuntime
    ? ctx.runtimeModelCatalog?.isReadOnly(selected.key)
      ? ctx.harnessRuntime.cached(selected.key)
      : await ctx.harnessRuntime.resolve(entry)
    : { ...entry, runtimeEnv: {} }
  if (!config) throw new Error(`Runtime model cache is unavailable for "${selected.key}"`)
  const prepared = prepareHarnessConfig({
    config,
    appEnv: turnAppEnv(ctx),
    baseEnv: processEnvRecord,
    customEnv: SPAWN_ENV_INJECTOR
  })

  const modelFamily = req.modelFamily ?? defaultModelFamily(selected.models)
  const model = modelNameForFamily(selected.models, modelFamily)
  // 제목 생성 모델은 요청 전에 사전 선택한다 (저가 모델 보유 시 그것, 없으면 default — 정책은
  // settings 레이어 resolveTitleModel 에 둔다).
  const titleModel = resolveTitleModel(selected.models)
  return {
    providerKey: selected.key,
    prepared,
    ...(model ? { model } : {}),
    ...(titleModel ? { titleModel } : {})
  }
}

// Harness+ModelProvider entry 를 **못 고른** 턴의 spawn 입력.
// 조립 규칙은 `prepareUnresolvedHarnessConfig` 가 소유한다.
function unresolvedPrepared(ctx: RouterContext): PreparedHarnessConfig {
  return prepareUnresolvedHarnessConfig({
    appEnv: turnAppEnv(ctx),
    baseEnv: processEnvRecord,
    customEnv: SPAWN_ENV_INJECTOR
  })
}

// orca.json 앱 전역 env 의 `${VAR}` 확장. **미해결 키는 드롭**된다(빈 문자열 치환 금지 —
// 조용한 미설정 진행 방지). 자격증명은 여기 없다 (0188): 실행 credential 은 Harness runtime
// config 의 `runtimeEnv` 로 오고, 두 레이어의 우선순위는 `prepareHarnessConfig` 가 정한다.
function turnAppEnv(ctx: RouterContext): Record<string, string> {
  const { env: expanded, missing } = expandEnvRecord(appEnv(), ctx.mcp.resolver())
  if (missing.length > 0) {
    getLogger()
      .child('config')
      .warn('config.env.unresolved', { missing, reason: 'app env keys skipped' })
  }
  return expanded
}
