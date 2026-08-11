import { describe, expect, it } from 'vitest'
import { evaluateGate } from './index'

describe('로그인 게이트 진리표 (AC8·AC14)', () => {
  // AC14 — **prod** OSS 기본 배포가 로그인 화면에 갇히지 않는다. 이 행이 무너지면 게이트
  // provider 를 선언하지 않은 릴리스가 영영 열리지 않는다.
  it('선언 0 이면 통과한다 (prod — required=false)', () => {
    expect(evaluateGate({ members: [], bypass: false })).toEqual({
      required: false,
      passed: true,
      bypassed: false
    })
  })

  it('선언 N · 하나도 인증 안 됨 → 차단', () => {
    const state = evaluateGate({
      members: [
        { providerId: 'sso', status: 'none', verified: false },
        { providerId: 'sso2', status: 'none', verified: false }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: false, bypassed: false })
  })

  // 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다(0172 의 결정 유지).
  it('선언 N · 일부만 valid → 차단', () => {
    const state = evaluateGate({
      members: [
        { providerId: 'sso', status: 'valid', verified: true },
        { providerId: 'sso2', status: 'expired', verified: false }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: false, bypassed: false })
  })

  it('선언 N · 전부 valid → 통과', () => {
    const state = evaluateGate({
      members: [
        { providerId: 'sso', status: 'valid', verified: true },
        { providerId: 'sso2', status: 'valid', verified: true }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: true, bypassed: false })
  })

  it('dev bypass 는 미인증이어도 통과시키되 우회했음을 표시한다', () => {
    const state = evaluateGate({
      members: [{ providerId: 'sso', status: 'none', verified: false }],
      bypass: true
    })
    expect(state).toEqual({ required: true, passed: true, bypassed: true })
  })

  // 'unknown'(복호화 실패)은 valid 가 아니다 — 키체인이 잠긴 상태로 조용히 들어가지 않는다.
  it('복호화 실패(unknown)는 통과로 치지 않는다', () => {
    const state = evaluateGate({
      members: [{ providerId: 'sso', status: 'unknown', verified: false }],
      bypass: false
    })
    expect(state.passed).toBe(false)
  })
})

// DEV 는 선언이 0개여도 게이트를 세운다 — 폐쇄망 실값이 없는 개발 환경에서 로그인 화면에
// **도달할 수 있어야** 한다. 0181 이 처음엔 prod 규칙을 DEV 에도 적용해, 우회 토글을 켜도
// 우회할 게이트가 없어 아무 일도 일어나지 않는 상태를 만들었다(사용자 보고).
describe('DEV 게이트 도달성 (alwaysRequired)', () => {
  it('선언 0 이어도 게이트를 세운다 — 로그인 화면이 뜬다', () => {
    expect(evaluateGate({ members: [], bypass: false, alwaysRequired: true })).toEqual({
      required: true,
      passed: false,
      bypassed: false
    })
  })

  it('우회 토글이 유일한 탈출구다', () => {
    expect(evaluateGate({ members: [], bypass: true, alwaysRequired: true })).toEqual({
      required: true,
      passed: true,
      bypassed: true
    })
  })

  // 회귀: `[].every(...)` 는 true 라, 멤버 수를 함께 보지 않으면 DEV 게이트가 즉시 열려
  // 원래 문제로 되돌아간다.
  it('빈 멤버 배열이 "전부 valid" 로 접히지 않는다', () => {
    expect(evaluateGate({ members: [], bypass: false, alwaysRequired: true }).passed).toBe(false)
  })

  it('선언이 있으면 DEV 여도 실제 인증으로 통과한다', () => {
    expect(
      evaluateGate({
        members: [{ providerId: 'sso', status: 'valid', verified: true }],
        bypass: false,
        alwaysRequired: true
      })
    ).toEqual({ required: true, passed: true, bypassed: false })
  })

  // ── 회귀: 복원된 grant 는 통과 근거가 아니다 ────────────────────────────────
  // 사용자 보고 — "구현한 sso provider 로 로그인 성공 시, 해당 provider 의 id 는 영구적으로
  // bypass 와 같은 현상". 원인은 `kind:'session'` grant 가 만료도 vault 도 없이 **기록만으로**
  // `status:'valid'` 가 되고, 게이트가 그 status 만 봤다는 것. 실행마다 확인이 필요하다.
  it('복원됐지만 이번 실행에서 미확인인 grant 는 게이트를 열지 않는다', () => {
    expect(
      evaluateGate({
        members: [{ providerId: 'sso', status: 'valid', verified: false }],
        bypass: false,
        alwaysRequired: true
      })
    ).toEqual({ required: true, passed: false, bypassed: false })
  })

  it('멤버 하나만 미확인이어도 차단된다', () => {
    expect(
      evaluateGate({
        members: [
          { providerId: 'sso', status: 'valid', verified: true },
          { providerId: 'sso2', status: 'valid', verified: false }
        ],
        bypass: false
      }).passed
    ).toBe(false)
  })

  // prod 경로는 그대로다 — alwaysRequired 를 넣지 않으면 선언 0 은 통과다.
  it('alwaysRequired 미지정(prod)은 기존 규칙을 유지한다', () => {
    expect(evaluateGate({ members: [], bypass: false }).required).toBe(false)
    expect(evaluateGate({ members: [], bypass: false, alwaysRequired: false }).required).toBe(false)
  })
})
