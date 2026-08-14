// 턴 셋업의 I/O 조각 — provider 해석 · subprocess env 조립 · 소유권 표시 발신 (0179).
// 순수 판정은 `admission.ts`, 순수 조립은 `turn-context.ts` 가 갖는다.

import type { WebContents } from 'electron'
import { appEnv } from '../../infra/config/orca-config'
import { expandEnvRecord, processEnvRecord } from '../../features/harnesses/env'
import {
  prepareHarnessConfig,
  type PreparedHarnessConfig
} from '../../features/harnesses/prepared-config'
import {
  defaultModelFamily,
  modelNameForFamily,
  resolveTitleModel
} from '../../features/harnesses/models'
import { defaultProvider } from '../../features/harnesses/settings-entries'
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
  const entries = ctx.harnessSettings.list(req.adapter.id)
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
  if (!selected) return { providerKey: null, prepared: emptyPrepared() }

  // ── 실행 구성 해석은 **턴당 1회** (0188 D-019) ────────────────────────────────
  // settings 해석과 동적 보강(있으면)을 한 번에 끝내고, 그 결과로 spawn 입력을 조립한다.
  // 정적 구성에서는 augmenter 가 없으므로 network 접근이 0이고 기존 mtime stat 만 남는다.
  const config = ctx.harnessRuntime
    ? await ctx.harnessRuntime.resolve({
        key: selected.key,
        harnessId: selected.harnessId,
        modelProviderId: selected.modelProviderId
      })
    : {
        key: selected.key,
        harnessId: selected.harnessId,
        modelProviderId: selected.modelProviderId,
        runtimeEnv: {}
      }
  const prepared = prepareHarnessConfig({
    config,
    appEnv: turnAppEnv(ctx),
    baseEnv: processEnvRecord
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

// settings 도 동적 구성도 없는 턴의 빈 spawn 입력. `runtimeEnvFingerprint` 가 상수라
// respawn 판정이 흔들리지 않는다.
function emptyPrepared(): PreparedHarnessConfig {
  return prepareHarnessConfig({
    config: { key: '', harnessId: '', modelProviderId: '', runtimeEnv: {} },
    baseEnv: processEnvRecord
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
