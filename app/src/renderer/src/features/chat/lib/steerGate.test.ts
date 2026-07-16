import { describe, expect, it } from 'vitest'
import { steerBlockedByProviderBoundary } from './steerGate'

// 0119 — busy 세션에서 provider 경계를 넘는 모델이 선택된 동안 steer(피드백 전송)를 막는다.
describe('steerBlockedByProviderBoundary(0119)', () => {
  it('inflight + 선택 provider ≠ 턴 provider 면 차단한다', () => {
    expect(
      steerBlockedByProviderBoundary({
        inflight: true,
        turnProviderKey: 'claude-anthropic',
        selectedProviderKey: 'claude-zai'
      })
    ).toBe(true)
  })

  it('같은 provider 선택은 차단하지 않는다 — 본래 모델로 되돌리면 steer 복구', () => {
    expect(
      steerBlockedByProviderBoundary({
        inflight: true,
        turnProviderKey: 'claude-anthropic',
        selectedProviderKey: 'claude-anthropic'
      })
    ).toBe(false)
  })

  it('유휴(inflight=false) 상태는 차단하지 않는다', () => {
    expect(
      steerBlockedByProviderBoundary({
        inflight: false,
        turnProviderKey: 'claude-anthropic',
        selectedProviderKey: 'claude-zai'
      })
    ).toBe(false)
  })

  it('턴 스냅샷 null(자동 연속 턴 등 BEGIN_TURN 미경유)은 보수적 허용', () => {
    expect(
      steerBlockedByProviderBoundary({
        inflight: true,
        turnProviderKey: null,
        selectedProviderKey: 'claude-zai'
      })
    ).toBe(false)
  })

  it('선택 null/undefined(선택 미확정)는 보수적 허용', () => {
    expect(
      steerBlockedByProviderBoundary({
        inflight: true,
        turnProviderKey: 'claude-anthropic',
        selectedProviderKey: null
      })
    ).toBe(false)
    expect(
      steerBlockedByProviderBoundary({
        inflight: true,
        turnProviderKey: 'claude-anthropic',
        selectedProviderKey: undefined
      })
    ).toBe(false)
  })
})
