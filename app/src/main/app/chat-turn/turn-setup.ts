// 턴 셋업의 I/O 조각 — provider 해석 · subprocess env 조립 · 소유권 표시 발신 (0179).
// 순수 판정은 `admission.ts`, 순수 조립은 `turn-context.ts` 가 갖는다.

import type { WebContents } from 'electron'
import { appEnv } from '../../infra/config/orca-config'
import {
  defaultModelFamily,
  defaultProvider,
  expandEnvRecord,
  mergeEnvLayers,
  modelNameForFamily,
  resolveTitleModel,
  type ResolvedProviderSettings
} from '../../features/providers/provider-settings'
import { getLogger } from '../../infra/log'
import { sendChatEvent } from '../../infra/ipc/send'
import type { RuntimeSessionAdapter } from '../../contracts/ports'
import type { TurnEventSink } from '../../features/chat/turn-sinks'
import type { RouterContext } from '../context'

// renderer forward sink — sendChatEvent 래핑. 코디네이터가 버스를 타지 않는 forward-only 이벤트
// (합성 error·turn.retrying·steer.flushed)에 쓴다.
export const chatForward: TurnEventSink<WebContents> = {
  forward: (owner, ev) => sendChatEvent(owner, ev)
}

export interface ResolvedTurnProvider {
  providerSettings?: ResolvedProviderSettings
  providerKey: string | null
  model?: string
  titleModel?: string
}

// 턴 단위 provider/model 해석 (handoff 0010 → 0014) — payload providerKey 가 어댑터와
// 일치하면 적용, 불일치/무효면 세션의 마지막 provider_key → 기본 provider(anthropic 우선) 폴백.
// 원천은 sources/settings/<adapter>/ 트리(ProviderSettingsService)이며, settings 해석(blob)은
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
  const entries = ctx.providerSettings.list(req.adapter.id)
  const meta = req.sessionId ? ctx.db.getSessionById(req.sessionId) : undefined
  const byKey = (key: string | null | undefined): (typeof entries)[number] | undefined =>
    key ? entries.find((entry) => entry.key === key) : undefined

  let selected = byKey(req.providerKey)
  if (req.sessionId && selected && selected.adapter !== meta?.backend) {
    getLogger().child('providers').warn('providers.key.mismatch', {
      providerKey: req.providerKey,
      reason: 'adapter mismatch — falling back to session provider'
    })
    selected = undefined
  }
  if (req.sessionId && !selected) selected = byKey(meta?.provider_key)
  if (!selected) selected = defaultProvider(entries)
  if (!selected) return { providerKey: null }

  const providerSettings = await ctx.providerSettings.resolve(selected)
  const modelFamily = req.modelFamily ?? defaultModelFamily(selected.models)
  const model = modelNameForFamily(selected.models, modelFamily)
  // 제목 생성 모델은 요청 전에 사전 선택한다 (저가 모델 보유 시 그것, 없으면 default — 정책은
  // settings 레이어 resolveTitleModel 에 둔다).
  const titleModel = resolveTitleModel(selected.models)
  return {
    providerKey: selected.key,
    ...(providerSettings ? { providerSettings } : {}),
    ...(model ? { model } : {}),
    ...(titleModel ? { titleModel } : {})
  }
}

// subprocess env 조립 — orca.json 앱 전역 env(${VAR} 확장)만 병합한다.
export function buildTurnEnv(ctx: RouterContext): Record<string, string> | undefined {
  const { env: expanded, missing } = expandEnvRecord(appEnv(), ctx.mcp.resolver())
  if (missing.length > 0) {
    getLogger()
      .child('config')
      .warn('config.env.unresolved', { missing, reason: 'app env keys skipped' })
  }
  return mergeEnvLayers(undefined, expanded)
}

// 소유권 표시(0151 AC12) 발신 단일 지점 — held(취소 가능) ↔ submitted(전달됨, 취소 불가) 전이를
// renderer 에 알린다. 버스 미경유 직행(message.queued 동렬 — 미영속 UI 상태). 턴 핸들러(활성 턴의
// wc)와 steerCancel 핸들러(event.sender)가 서로 다른 WebContents 를 쓰므로 인자로 받는다.
export function sendSubmitted(
  wc: WebContents,
  sessionId: string,
  ids: string[],
  submitted: boolean
): void {
  if (ids.length === 0) return
  sendChatEvent(wc, { type: 'message.submitted', sessionId, ids, submitted })
}
