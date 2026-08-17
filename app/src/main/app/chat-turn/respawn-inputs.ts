// respawn 판정 입력 조립 (0190).
//
// **왜 `features/sessions/respawn-policy.ts` 옆이 아닌가**: 조립에는 경계 술어 3종이 필요한데
// 그것들은 `features/harnesses/runtime-boundary.ts` 에 있다. feature 끼리는 교차 import 가
// 금지되므로 두 슬라이스를 함께 아는 자리는 컴포지션 루트뿐이다.
//
// **왜 함수로 묶는가**: 최초 턴(`runtime-entry.ts`)과 자동 연속 턴(`chat-turn-continuation.ts`)이
// 같은 7필드를 각각 손으로 적고 있었다. 0188 이 그 둘에 `runtimeEnvChanged` 축을 더할 때 양쪽을
// 함께 고쳐야 했고, 다음에 축이 하나 더 생기면 **한쪽만 갱신되는** 회귀가 난다 — 그러면 최초
// 턴은 respawn 하는데 연속 턴은 낡은 채널을 그대로 쓰는(또는 그 반대) 비대칭이 조용히 생긴다.
//
// 판정 규칙 자체는 여전히 `decideRespawn` 이 소유한다. 여기서는 **입력만** 모은다.

import type { PreparedHarnessConfig, ResolvedHarnessSettings } from '../../adapters/harness-config'
import {
  crossesProviderBoundary,
  providerSettingsChangedSinceSpawn,
  runtimeEnvChangedSinceSpawn
} from '../../features/harnesses/runtime-boundary'
import type { RespawnDecisionInput } from '../../features/sessions/respawn-policy'

// spawn 당시의 기록. `SessionRuntime` 이 구조적으로 만족한다 — 구현 타입을 물지 않아야
// 이 조립을 IPC·electron 없이 단위 테스트할 수 있다.
export interface SpawnRecord {
  channelAlive: boolean
  spawnedModel: string | undefined
  spawnedProviderSettings: ResolvedHarnessSettings | undefined
  spawnedRuntimeEnvFingerprint: string | undefined
  spawnedRuntimeToolsRevision: number | undefined
}

export function respawnInputs(input: {
  runtime: SpawnRecord
  prepared: PreparedHarnessConfig
  // 세션이 마지막으로 쓴 Harness+ModelProvider 키. 레거시 세션은 없을 수 있다.
  previousProviderKey: string | null | undefined
  // 이번 턴이 해석한 키. 해석 실패는 `null` 이고 경계로 치지 않는다(0118).
  nextProviderKey: string | null
  model: string | undefined
  runtimeToolsRevision: number | undefined
}): RespawnDecisionInput {
  const { runtime, prepared } = input
  return {
    channelAlive: runtime.channelAlive,
    providerBoundaryChanged: crossesProviderBoundary(
      input.previousProviderKey,
      input.nextProviderKey
    ),
    modelChanged: input.model !== runtime.spawnedModel,
    providerSettingsChanged: providerSettingsChangedSinceSpawn(
      runtime.spawnedProviderSettings,
      prepared.providerSettings
    ),
    // 어느 한쪽이 없으면(콜드 스타트 · 이번 턴 해석 실패) 판정하지 않는다 — 보수적 no-op
    // (0118/0125 null 의미론). 규칙은 `runtimeEnvChangedSinceSpawn` 하나가 갖는다.
    runtimeEnvChanged: runtimeEnvChangedSinceSpawn(
      runtime.spawnedRuntimeEnvFingerprint,
      prepared.runtimeEnvFingerprint
    ),
    spawnedRuntimeToolsRevision: runtime.spawnedRuntimeToolsRevision,
    runtimeToolsRevision: input.runtimeToolsRevision
  }
}
