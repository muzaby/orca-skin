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
        { authId: 'sso', status: 'none', verified: false },
        { authId: 'sso2', status: 'none', verified: false }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: false, bypassed: false })
  })

  // 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다(0172 의 결정 유지).
  it('선언 N · 일부만 valid → 차단', () => {
    const state = evaluateGate({
      members: [
        { authId: 'sso', status: 'valid', verified: true },
        { authId: 'sso2', status: 'expired', verified: false }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: false, bypassed: false })
  })

  it('선언 N · 전부 valid → 통과', () => {
    const state = evaluateGate({
      members: [
        { authId: 'sso', status: 'valid', verified: true },
        { authId: 'sso2', status: 'valid', verified: true }
      ],
      bypass: false
    })
    expect(state).toEqual({ required: true, passed: true, bypassed: false })
  })

  it('dev bypass 는 미인증이어도 통과시키되 우회했음을 표시한다', () => {
    const state = evaluateGate({
      members: [{ authId: 'sso', status: 'none', verified: false }],
      bypass: true
    })
    expect(state).toEqual({ required: true, passed: true, bypassed: true })
  })

  // 'unknown'(복호화 실패)은 valid 가 아니다 — 키체인이 잠긴 상태로 조용히 들어가지 않는다.
  it('복호화 실패(unknown)는 통과로 치지 않는다', () => {
    const state = evaluateGate({
      members: [{ authId: 'sso', status: 'unknown', verified: false }],
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
        members: [{ authId: 'sso', status: 'valid', verified: true }],
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
        members: [{ authId: 'sso', status: 'valid', verified: false }],
        bypass: false,
        alwaysRequired: true
      })
    ).toEqual({ required: true, passed: false, bypassed: false })
  })

  it('멤버 하나만 미확인이어도 차단된다', () => {
    expect(
      evaluateGate({
        members: [
          { authId: 'sso', status: 'valid', verified: true },
          { authId: 'sso2', status: 'valid', verified: false }
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

// ── gate membership 의 runtime fail-closed (0188 AC4) ────────────────────────
//
// 타입(`GateAuthDefinition`)이 compile time 에 `probe` 를 강제하지만 `as` 우회와 등록 탈락은
// 막지 못한다. 그때 멤버에서 **빼기만 하면** `members.length === 0` 이 되어 prod gate 가
// required:false 로 열린다 — 그것이 "확인 없이 통과하는 게이트" 다.

import type { AuthSnapshot, BoundAuth, GateAuthDefinition } from '../../contracts/auth'
import { createGate, selectGateMembers } from './index'

function definition(id: string, withProbe = true): GateAuthDefinition {
  return {
    id,
    label: id,
    origin: `https://${id}.example.corp`,
    methods: [],
    ...(withProbe ? { probe: { path: '/api/me' } } : {})
  } as GateAuthDefinition
}

function bound(id: string, snapshot: Partial<AuthSnapshot> = {}): BoundAuth {
  return {
    authId: id,
    snapshot: () => ({
      authId: id,
      status: 'valid',
      verified: true,
      credentialRevision: 0,
      ...snapshot
    }),
    request: () => Promise.reject(new Error('not used'))
  }
}

describe('selectGateMembers (AC4)', () => {
  it('probe 가 있고 등록된 정의만 멤버가 된다', () => {
    const selection = selectGateMembers([definition('sso')], (id) => bound(id))
    expect(selection.members.map((member) => member.authId)).toEqual(['sso'])
    expect(selection.blocked).toEqual([])
  })

  it('probe 없는 정의는 멤버에서 빠지고 blocked 로 보고된다', () => {
    const selection = selectGateMembers([definition('sso', false)], (id) => bound(id))
    expect(selection.members).toEqual([])
    expect(selection.blocked).toEqual([{ authId: 'sso', reason: 'missing_probe' }])
  })

  it('등록에서 떨어진 정의도 blocked 다', () => {
    const selection = selectGateMembers([definition('sso')], () => null)
    expect(selection.blocked).toEqual([{ authId: 'sso', reason: 'unregistered' }])
  })
})

describe('createGate (AC4)', () => {
  it('valid + verified 면 통과한다', () => {
    const gate = createGate({ members: [bound('sso')], bypass: () => false })
    expect(gate.state()).toEqual({ required: true, passed: true, bypassed: false })
  })

  it('valid 만으로는 통과하지 않는다 — 복원된 기록은 인증이 아니다', () => {
    const gate = createGate({ members: [bound('sso', { verified: false })], bypass: () => false })
    expect(gate.state().passed).toBe(false)
  })

  it('확인할 수 없는 선언이 있으면 나머지가 통과해도 열지 않는다 (fail-closed)', () => {
    const gate = createGate({ members: [bound('sso')], blockedMembers: 1, bypass: () => false })
    expect(gate.state()).toEqual({ required: true, passed: false, bypassed: false })
  })

  it('blocked 상태에서도 dev 우회는 유효하다 — 탈출구까지 막으면 화면에 도달할 수 없다', () => {
    const gate = createGate({ members: [], blockedMembers: 1, bypass: () => true })
    expect(gate.state()).toEqual({ required: true, passed: true, bypassed: true })
  })

  it('bypass 는 읽는 시점의 값이다 — 설정이 런타임에 바뀐다', () => {
    let bypass = false
    const gate = createGate({ members: [bound('sso', { verified: false })], bypass: () => bypass })
    expect(gate.state().passed).toBe(false)
    bypass = true
    expect(gate.state().passed).toBe(true)
  })
})
