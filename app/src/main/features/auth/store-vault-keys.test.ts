// Grant → vault 키 도출의 단일 규칙 (0190 AC6).
//
// 0188 은 이 도출을 네 곳에 손으로 적었다 — 부팅 고아 sweep 의 **참조 집합**, 해제의 **삭제
// 목록**, 자격증명 교체의 `kept` 와 `names`. 두 쪽이 말하는 것이 정반대라서(살아 있다 / 지운다)
// 어긋나면 **살아 있는 grant 가 가리키는 키를 부팅이 지운다.** vault 값은 복구되지 않는다.
//
// 그래서 이 파일은 "함수가 있다" 가 아니라 **세 kind 각각이 어떤 키를 가리키는가**를 잠근다.

import { describe, expect, it } from 'vitest'
import type { Grant } from '../../contracts/auth'
import { vaultKeysOf } from './store'

describe('vaultKeysOf', () => {
  it('secret grant 는 자기 vaultKey 하나를 가리킨다', () => {
    const grant: Grant = {
      kind: 'secret',
      vaultKey: 'auth:wiki:pat@v1',
      authKind: 'pat',
      createdAt: 1
    }

    expect(vaultKeysOf(grant)).toEqual(['auth:wiki:pat@v1'])
  })

  it('refreshKey 없는 token grant 는 vaultKey 하나만 가리킨다', () => {
    const grant: Grant = {
      kind: 'token',
      vaultKey: 'auth:corp:oauth@v1',
      authKind: 'oauth',
      createdAt: 1
    }

    expect(vaultKeysOf(grant)).toEqual(['auth:corp:oauth@v1'])
  })

  // 여기가 0188 의 네 사본이 가장 쉽게 갈리던 자리다 — refresh 키를 빠뜨린 사본이 sweep 쪽에
  // 있으면 부팅이 살아 있는 refresh token 을 고아로 보고 지운다.
  it('refreshKey 있는 token grant 는 두 키를 모두 가리킨다', () => {
    const grant: Grant = {
      kind: 'token',
      vaultKey: 'auth:corp:oauth@v1',
      refreshKey: 'auth:corp:oauth:refresh@v1',
      authKind: 'oauth',
      createdAt: 1
    }

    expect(vaultKeysOf(grant)).toEqual(['auth:corp:oauth@v1', 'auth:corp:oauth:refresh@v1'])
  })

  // session grant 의 값은 cookie jar 가 갖는다 — vault 키가 없다. 여기서 빈 배열이 아니면
  // 해제가 존재하지 않는 키를 지우려 하고, sweep 은 없는 참조를 살려 둔다.
  it('session grant 는 vault 를 쓰지 않는다', () => {
    const grant: Grant = {
      kind: 'session',
      sessionGroup: 'corp',
      authKind: 'browser-session',
      createdAt: 1
    }

    expect(vaultKeysOf(grant)).toEqual([])
  })

  // `discardKeys(grant, keep)` 는 `keep` 이 없을 수 있다 — 호출부가 분기하지 않게 여기서 받는다.
  it('undefined 는 빈 배열이다', () => {
    expect(vaultKeysOf(undefined)).toEqual([])
  })
})
