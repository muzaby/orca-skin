import { describe, expect, it } from 'vitest'
import { shouldQueueAsPending, steerBlockedByProviderBoundary } from './sendAdmission'

// 0153 — 낙관 커밋(0068)이 정당한 조건의 명시. main 이 이 메시지를 **즉시** 턴 프롬프트로 쓸 때만
// 참이고, 그 밖에는 예약 경로여야 라이브 버블 순서가 main 커밋 순서(DB `idx`)와 일치한다.
describe('shouldQueueAsPending (0153)', () => {
  const idle = { inflight: false, listening: false, pendingCount: 0 }

  it('완전 유휴 → 낙관 커밋 허용 (통상 첫 send 반응성 보존)', () => {
    expect(shouldQueueAsPending(idle)).toBe(false)
  })

  it('내 턴 진행 중 → 예약', () => {
    expect(shouldQueueAsPending({ ...idle, inflight: true })).toBe(true)
  })

  it('턴-후 체인 진행 중(listening) → 예약 (0143)', () => {
    expect(shouldQueueAsPending({ ...idle, listening: true })).toBe(true)
  })

  it('**핵심** — inflight·listening 이 모두 false 여도 미확정 예약이 있으면 예약', () => {
    // 관측된 순서 역전의 판정 지점: telemetry 로 inflight 가 내려가고 activity snapshot이
    // 아직 도착하지 않은 창. 잔여 예약이 보이는 이상 이 메시지는 그 뒤에 커밋된다.
    expect(shouldQueueAsPending({ ...idle, pendingCount: 3 })).toBe(true)
  })
})

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
