// AC14 배선 — `respawnInputs` 가 worktree 폴백 축을 **싣는지** 본다 (WP-18).
//
// `respawn-policy.test.ts` 는 판정 규칙을, `prepare-worktree.test.ts` 는 그 위의 전달을 잠근다.
// 그 둘 사이의 조립이 이 파일이다 — 여기가 비면 판정도 전달도 초록인데 축이 상수로 굳는다.

import { describe, expect, it } from 'vitest'
import { respawnInputs } from './respawn-inputs'
import type { PreparedHarnessConfig } from '../../adapters/harness-config'

const runtime = {
  channelAlive: true,
  spawnedModel: 'm',
  spawnedProviderSettings: undefined,
  spawnedRuntimeEnvFingerprint: undefined,
  spawnedRuntimeToolsRevision: 1
}

const prepared = {
  providerSettings: undefined,
  runtimeEnvFingerprint: undefined
} as unknown as PreparedHarnessConfig

const base = {
  runtime,
  prepared,
  previousProviderKey: 'claude:test',
  nextProviderKey: 'claude:test',
  model: 'm',
  runtimeToolsRevision: 1
}

describe('respawnInputs — worktree 폴백 축 (AC14)', () => {
  it('입력의 폴백 여부를 그대로 싣는다 — 양방향', () => {
    expect(respawnInputs({ ...base, executionCwdRecovered: true }).executionCwdRecovered).toBe(true)
    expect(respawnInputs({ ...base, executionCwdRecovered: false }).executionCwdRecovered).toBe(
      false
    )
  })
})
