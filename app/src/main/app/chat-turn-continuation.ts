// 자동 연속 턴의 실행 구성 준비 (0126 → 0188).
//
// ── 0188 이 고친 비대칭 ──────────────────────────────────────────────────────
// 구 구현은 continuation 마다 **settings 만** 새로 해석하고 `env` 는 최초 값을 그대로 뒀다.
// `buildListenRequest` 는 `env` 를 아예 싣지 않았고 `buildFlushRequest` 는 원 request 를
// spread 해 **옛 env** 를 실었다. settings 만 신선하고 동적 credential 은 낡은 상태 —
// 폐쇄망에서 토큰이 회전하면 continuation 이 죽은 토큰으로 respawn 한다.
//
// 이제 **전체 runtime config 를 continuation 마다 한 번 다시 resolve** 하고(warm cache 허용 —
// 원격 재조회는 만료·무효화 때만), 같은 continuation 의 listen/flush 가 그 결과 하나를 공유한다.
//
// env 는 spawn-bound 라 살아 있는 channel 의 push 에는 재주입되지 않는다. 그럼에도 두 request
// 에 모두 싣는 이유는 **fingerprint 변경·도구 변경·모델 변경 또는 예기치 않은 channel 종료로
// 어느 분기에서든 새 spawn 이 필요할 때 fresh env 가 빠지지 않아야** 하기 때문이다.

import type { TurnExtensions } from '../adapters/turn'
import type { ResolvedHarnessSettings } from '../adapters/harness-config'
import {
  crossesProviderBoundary,
  providerSettingsChangedSinceSpawn
} from '../features/harnesses/runtime-boundary'
import type { PreparedHarnessConfig } from '../features/harnesses/prepared-config'
import { decideRespawn } from '../features/sessions/respawn-policy'

export interface AutomaticContinuationRuntime {
  readonly channelAlive: boolean
  readonly spawnedProviderSettings: ResolvedHarnessSettings | undefined
  readonly spawnedRuntimeEnvFingerprint: string | undefined
  readonly spawnedModel: string | undefined
  readonly spawnedRuntimeToolsRevision: number | undefined
}

interface AutomaticContinuationResolution {
  providerKey: string | null
  prepared: PreparedHarnessConfig
  model?: string
}

interface PreparedAutomaticContinuation {
  extensions: TurnExtensions
  // **fresh spawn 입력 한 벌.** listen 과 flush 가 이 객체의 `providerSettings` 와 `env` 를
  // 같은 값으로 전달한다.
  prepared: PreparedHarnessConfig
  model?: string
  shouldRespawn: boolean
}

// Listen and flush must compare and send the exact same fresh extension snapshot.
export async function prepareAutomaticContinuation(input: {
  runtime: AutomaticContinuationRuntime
  providerKey: string | null
  modelFamily: string | null
  fallbackModel: string | undefined
  resolveProvider: (request: {
    providerKey: string | null
    modelFamily: string | null
  }) => Promise<AutomaticContinuationResolution>
  buildExtensions: () => TurnExtensions
}): Promise<PreparedAutomaticContinuation> {
  const resolved = await input.resolveProvider({
    providerKey: input.providerKey,
    modelFamily: input.modelFamily
  })
  const extensions = input.buildExtensions()
  const model = resolved.model ?? input.fallbackModel

  return {
    extensions,
    prepared: resolved.prepared,
    ...(model !== undefined ? { model } : {}),
    shouldRespawn: decideRespawn({
      channelAlive: input.runtime.channelAlive,
      providerBoundaryChanged: crossesProviderBoundary(input.providerKey, resolved.providerKey),
      modelChanged: model !== input.runtime.spawnedModel,
      providerSettingsChanged: providerSettingsChangedSinceSpawn(
        input.runtime.spawnedProviderSettings,
        resolved.prepared.providerSettings
      ),
      // spawn 기록이 없으면(콜드 스타트) 판정하지 않는다 — 보수적 no-op(0118 null 의미론).
      runtimeEnvChanged:
        input.runtime.spawnedRuntimeEnvFingerprint !== undefined &&
        input.runtime.spawnedRuntimeEnvFingerprint !== resolved.prepared.runtimeEnvFingerprint,
      spawnedRuntimeToolsRevision: input.runtime.spawnedRuntimeToolsRevision,
      runtimeToolsRevision: extensions.runtimeTools?.revision
    })
  }
}
