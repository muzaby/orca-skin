import { describe, expect, it } from 'vitest'
import { decideRespawn } from './respawn-policy'

describe('decideRespawn', () => {
  const unchanged = {
    channelAlive: true,
    providerBoundaryChanged: false,
    modelChanged: false,
    providerSettingsChanged: false,
    runtimeEnvChanged: false,
    executionCwdRecovered: false,
    spawnedRuntimeToolsRevision: 4,
    runtimeToolsRevision: 4
  }

  it('keeps an alive channel when every spawn-bound input is unchanged', () => {
    expect(decideRespawn(unchanged)).toBe(false)
  })

  it.each([
    ['provider boundary', { providerBoundaryChanged: true }],
    ['model', { modelChanged: true }],
    ['provider settings', { providerSettingsChanged: true }],
    // 0188 — settings 는 그대로인데 `options.env` 의 토큰·URL·모델 변수만 바뀐 경우.
    ['runtime config env', { runtimeEnvChanged: true }],
    ['runtime tool revision', { runtimeToolsRevision: 5 }],
    // 0210 — worktree 소실 폴백. cwd 는 spawn 인자라 살아 있는 채널을 새 경로로 돌릴 수 없다.
    ['execution cwd recovery', { executionCwdRecovered: true }]
  ])('respawns for a changed %s', (_reason, changed) => {
    expect(decideRespawn({ ...unchanged, ...changed })).toBe(true)
  })

  it('never requests teardown when no channel is alive', () => {
    expect(decideRespawn({ ...unchanged, channelAlive: false, runtimeToolsRevision: 5 })).toBe(
      false
    )
  })
})
