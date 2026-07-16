import { describe, expect, it } from 'vitest'
import { crossesProviderBoundary } from './provider-boundary'

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
