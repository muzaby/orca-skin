// 입력 수집형 자격증명 spec — compose 와 그 **역방향** (0237 ΔV3 — D-054 / EP-24).
//
// **접는 쪽과 펴는 쪽이 같은 파일에 있다.** 규칙이 갈리면 소비자가 각자 구현하고 한쪽만
// 고쳐진다 — 0237 G4 가 그 상태였다(mail 슬라이스가 `:` 규칙을 몰라 합성형을 통째로 `PASS` 로
// 전송했다). feature 교차 import 가 막혀 있어 mail 은 이 함수를 부를 수도 없다 — 컴포지션
// 루트가 편 값을 주입한다.

import { describe, expect, it } from 'vitest'
import { apiKeySpec, passwordSpec, patSpec, unfoldCredential } from './credential'
import type { Presentation } from '../../../contracts/auth'

const BEARER: Presentation = { location: 'header', name: 'Authorization', scheme: 'bearer' }

describe('passwordSpec — compose', () => {
  const spec = passwordSpec({ label: '메일', present: BEARER })

  it('두 값을 user:pass 로 접고 아이디를 principalId 로 싣는다', () => {
    expect(spec.kind).toBe('password')
    if (!('compose' in spec)) throw new Error('compose 가 있어야 한다')
    expect(spec.compose({ username: 'alice@corp', password: 'pw:with:colons' })).toEqual({
      value: 'alice@corp:pw:with:colons',
      principalId: 'alice@corp'
    })
  })

  it('아이디의 콜론은 거부한다 — 조용히 잘리지 않는다', () => {
    if (!('compose' in spec)) throw new Error('compose 가 있어야 한다')
    expect(spec.compose({ username: 'a:b', password: 'p' })).toEqual({
      error: '아이디에 콜론(:)을 쓸 수 없습니다'
    })
  })

  it('비밀번호는 trim 하지 않는다 — 앞뒤 공백이 유효할 수 있다', () => {
    if (!('compose' in spec)) throw new Error('compose 가 있어야 한다')
    expect(spec.compose({ username: 'u', password: ' p ' })).toMatchObject({ value: 'u: p ' })
  })
})

describe('unfoldCredential — compose 의 역방향', () => {
  it('passwordSpec 이 접은 값을 그대로 편다 (왕복)', () => {
    const spec = passwordSpec({ label: '메일', present: BEARER })
    if (!('compose' in spec)) throw new Error('compose 가 있어야 한다')
    const folded = spec.compose({ username: 'alice@corp', password: 'pw:with:colons' })
    if (!('value' in folded)) throw new Error('compose 가 성공해야 한다')

    expect(unfoldCredential('password', folded.value, folded.principalId)).toEqual({
      kind: 'password',
      username: 'alice@corp',
      password: 'pw:with:colons'
    })
  })

  it('첫 콜론만 구분자다 — 비밀번호의 콜론은 보존된다', () => {
    expect(unfoldCredential('password', 'a:b:c')).toEqual({
      kind: 'password',
      username: 'a',
      password: 'b:c'
    })
  })

  it('콜론이 없으면 opaque 다 — 조용히 빈 아이디를 만들지 않는다', () => {
    expect(unfoldCredential('password', 'nocolon')).toEqual({ kind: 'opaque', value: 'nocolon' })
  })

  it('oauth 는 principalId 를 계정으로 싣는다 — XOAUTH2 가 계정을 요구한다', () => {
    expect(unfoldCredential('oauth', 'ya29.token', 'bob@corp')).toEqual({
      kind: 'token',
      username: 'bob@corp',
      accessToken: 'ya29.token'
    })
  })

  it('pat·api-key 는 opaque 로 남는다', () => {
    expect(patSpec({ label: 'PAT', fieldLabel: 'PAT', present: BEARER }).kind).toBe('pat')
    expect(apiKeySpec({ label: 'Key', fieldLabel: 'Key', present: BEARER }).kind).toBe('api-key')
    expect(unfoldCredential('pat', 'glpat-xxx')).toEqual({ kind: 'opaque', value: 'glpat-xxx' })
    expect(unfoldCredential('api-key', 'sk-xxx')).toEqual({ kind: 'opaque', value: 'sk-xxx' })
  })
})
