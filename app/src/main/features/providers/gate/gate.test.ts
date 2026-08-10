import { describe, expect, it } from 'vitest'
import { evaluateGate } from './index'

describe('로그인 게이트 진리표 (AC8·AC14)', () => {
  // AC14 — dev/OSS 기본 배포가 로그인 화면에 갇히지 않는다. 이 행이 무너지면 게이트 provider 를
  // 선언하지 않은 빌드가 영영 열리지 않는다.
  it('선언 0 이면 통과한다 (required=false)', () => {
    expect(evaluateGate({ members: [], bypass: false })).toEqual({
      required: false,
      passed: true,
      bypassed: false
    })
  })

  it('선언 N · 하나도 인증 안 됨 → 차단', () => {
    const state = evaluateGate({
      members: [
        { providerId: 'sso', status: 'none' },
        { providerId: 'sso2', status: 'none' }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: false, bypassed: false })
  })

  // 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다(0172 의 결정 유지).
  it('선언 N · 일부만 valid → 차단', () => {
    const state = evaluateGate({
      members: [
        { providerId: 'sso', status: 'valid' },
        { providerId: 'sso2', status: 'expired' }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: false, bypassed: false })
  })

  it('선언 N · 전부 valid → 통과', () => {
    const state = evaluateGate({
      members: [
        { providerId: 'sso', status: 'valid' },
        { providerId: 'sso2', status: 'valid' }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: true, bypassed: false })
  })

  it('dev bypass 는 미인증이어도 통과시키되 우회했음을 표시한다', () => {
    const state = evaluateGate({
      members: [{ providerId: 'sso', status: 'none' }],
      bypass: true
    })
    expect(state).toEqual({ required: true, passed: true, bypassed: true })
  })

  // 'unknown'(복호화 실패)은 valid 가 아니다 — 키체인이 잠긴 상태로 조용히 들어가지 않는다.
  it('복호화 실패(unknown)는 통과로 치지 않는다', () => {
    const state = evaluateGate({
      members: [{ providerId: 'sso', status: 'unknown' }],
      bypass: false
    })
    expect(state.passed).toBe(false)
  })
})
