import { describe, expect, it } from 'vitest'
import { crossesProviderBoundary, providerSettingsChangedSinceSpawn } from './provider-boundary'
import type { ResolvedProviderSettings } from '../../adapters/provider-config'

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
  const resolved = (settings: Record<string, unknown>): ResolvedProviderSettings => ({
    providerKey: 'claude-gateway',
    provider: 'gateway',
    settings
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
