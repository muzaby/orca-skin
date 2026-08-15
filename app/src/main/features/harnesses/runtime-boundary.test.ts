import { describe, expect, it } from 'vitest'
import {
  crossesProviderBoundary,
  providerSettingsChangedSinceSpawn,
  runtimeEnvChangedSinceSpawn
} from './runtime-boundary'
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'

// 0118 — chat:send 시점의 provider 경계 판정. true 일 때만 chat-turn 이 살아있는 채널을
// teardown 해 spawn(resume) 콜드 패스로 보낸다.
describe('crossesProviderBoundary(0118)', () => {
  it('providerKey 가 다르면 경계를 넘는다', () => {
    expect(crossesProviderBoundary('claude-anthropic', 'claude-zai')).toBe(true)
  })

  it('같은 providerKey 는 경계가 아니다 — 채널 재사용(모델 변경은 setModel 라이브 적용)', () => {
    expect(crossesProviderBoundary('claude-anthropic', 'claude-anthropic')).toBe(false)
  })

  it('이전 키 null/undefined(레거시 세션·미영속)는 경계 아님 — 보수적 no-op', () => {
    expect(crossesProviderBoundary(null, 'claude-anthropic')).toBe(false)
    expect(crossesProviderBoundary(undefined, 'claude-anthropic')).toBe(false)
  })

  it('해석 실패(resolved null)는 경계 아님', () => {
    expect(crossesProviderBoundary('claude-anthropic', null)).toBe(false)
  })
})

// 0125 — 같은 provider settings.json 제자리 수정 판정. true 일 때 chat-turn 이 0118 경계와
// 동일하게 채널을 teardown 해 새 settings 로 respawn 한다.
describe('providerSettingsChangedSinceSpawn(0125)', () => {
  const resolved = (settings: Record<string, unknown>): ResolvedHarnessSettings => ({
    providerKey: 'claude-gateway',
    provider: 'gateway',
    settings,
    sourceRevision: 'rev'
  })

  it('settings 내용이 바뀌면(토큰 로테이션) 변경이다', () => {
    const spawned = resolved({ env: { ANTHROPIC_AUTH_TOKEN: 'old' } })
    const next = resolved({ env: { ANTHROPIC_AUTH_TOKEN: 'rotated' } })
    expect(providerSettingsChangedSinceSpawn(spawned, next)).toBe(true)
  })

  it('재파싱된 동일 내용(다른 객체)은 변경 아님 — invalidateAll 후 불필요 respawn 금지', () => {
    const spawned = resolved({ env: { ANTHROPIC_BASE_URL: 'https://gw' } })
    const next = resolved({ env: { ANTHROPIC_BASE_URL: 'https://gw' } })
    expect(providerSettingsChangedSinceSpawn(spawned, next)).toBe(false)
  })

  it('동일 참조(resolve 캐시 히트)는 변경 아님 — 상시 경로 fast-path', () => {
    const same = resolved({ env: { ANTHROPIC_AUTH_TOKEN: 'x' } })
    expect(providerSettingsChangedSinceSpawn(same, same)).toBe(false)
  })

  it('spawn 기록/해석 어느 한쪽 부재는 보수적 no-op(0118 null 의미론)', () => {
    const some = resolved({ env: {} })
    expect(providerSettingsChangedSinceSpawn(undefined, some)).toBe(false)
    expect(providerSettingsChangedSinceSpawn(some, undefined)).toBe(false)
    expect(providerSettingsChangedSinceSpawn(undefined, undefined)).toBe(false)
  })
})

// 0188 r10 — env 축의 같은 판정. settings 축(위)과 **겹치지 않는 축**이며 null 의미론만 공유한다.
describe('runtimeEnvChangedSinceSpawn(0188 r10)', () => {
  it('spawn 당시와 최종 env 가 다르면 변경이다 — 토큰·URL·모델 변수 회전', () => {
    expect(runtimeEnvChangedSinceSpawn('fp-old', 'fp-new')).toBe(true)
  })

  it('같으면 변경 아님 — 정상 steady state 의 persistent runtime 재사용', () => {
    expect(runtimeEnvChangedSinceSpawn('fp', 'fp')).toBe(false)
  })

  // 여기가 r10 회귀의 본체다. `undefined` 는 "env 가 비었다" 가 아니라 **판정 불가**다 —
  // 이번 턴이 Harness+ModelProvider entry 를 못 골랐다는 뜻이고, 그것을 변화로 읽으면
  // sources 디렉터리가 잠깐 안 보이는 턴마다 살아 있는 채널이 내려간다.
  it('spawn 기록/이번 턴 어느 한쪽 부재는 보수적 no-op — 해석 실패는 경계가 아니다', () => {
    expect(runtimeEnvChangedSinceSpawn(undefined, 'fp')).toBe(false)
    expect(runtimeEnvChangedSinceSpawn('fp', undefined)).toBe(false)
    expect(runtimeEnvChangedSinceSpawn(undefined, undefined)).toBe(false)
  })
})
