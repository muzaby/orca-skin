// AuthStore 의 authId 축 상태 characterization (0190 r2 · AC10 선행).
//
// **이 파일이 없던 동안 `AuthStore` 를 직접 겨누는 테스트는 하나도 없었다** — 커버리지는
// `runtime.test.ts`·`login.test.ts` 를 통한 간접뿐이었다. authId 하나의 상태가 자료구조 네 개에
// 흩어져 있고 mutator 다섯이 그것을 손으로 동기화하는 구조라, 통합 리팩토링의 그물이 간접
// 커버리지뿐이면 어긋남이 조용히 지나간다.
//
// 그래서 통합 **전에** 지금 동작을 못 박는다. 아래 단언은 전부 0188 이 라운드를 써서 고친
// 자리들이고, 통합 후에도 한 글자도 달라지면 안 되는 것들이다.

import { describe, expect, it } from 'vitest'
import type { Grant } from '../../contracts/auth'
import { createVault, type Vault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { AuthStore, createMemoryGrantPersistence } from './store'

function fakeSecretStore(): SecretStorePort {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key)
  }
}

const NOW = 10_000

function secretGrant(vaultKey = 'wiki:pat@v1', expiresAt?: number): Grant {
  return {
    kind: 'secret',
    vaultKey,
    authKind: 'pat',
    createdAt: 1,
    ...(expiresAt === undefined ? {} : { expiresAt })
  }
}

// `status()` 는 vault 를 실제로 읽는다 — grant 만 심고 값을 안 넣으면 `none` 이다.
// 그래서 seed grant 의 키에는 값도 함께 넣고, 테스트가 나중에 새 키를 쓸 수 있게 vault 를 돌려준다.
function build(
  clock: () => number = () => NOW,
  seed: Record<string, Grant> = {}
): { store: AuthStore; vault: Vault } {
  const vault = createVault(fakeSecretStore())
  for (const grant of Object.values(seed)) {
    if (grant.kind !== 'session') {
      vault.set(grant.vaultKey, 'value', { kind: 'pat', createdAt: 1 })
    }
  }
  const store = new AuthStore({ persistence: createMemoryGrantPersistence(seed), vault, clock })
  return { store, vault }
}

describe('AuthStore — authId 축 상태', () => {
  // **해제는 grant 를 지우지만 세대는 지우지 않는다.**
  //
  // 여기가 authId 상태를 한 자료구조로 접을 때 가장 깨지기 쉬운 자리다. 해제를 "이 authId 의
  // 항목을 통째로 지운다" 로 옮기면 revision 이 0 으로 되돌아가고, 다음 로그인이 다시 1 을
  // 낸다 — `AuthChange` 소비자(Harness config cache·Plugin 도구 sync)는 "그때 값과 지금 값이
  // 같은가" 를 revision 으로 판정하므로, 해제 전 1 과 재로그인 후 1 을 **같은 세대로 읽는다.**
  // 죽은 토큰으로 만든 실행 구성이 warm hit 로 계속 돌아온다.
  it('해제 후에도 credentialRevision 이 되돌아가지 않는다', () => {
    const { store } = build()
    store.restore(['wiki'])

    store.put('wiki', secretGrant())
    const afterLogin = store.credentialRevision('wiki')

    expect(store.revoke('wiki')).toMatchObject({ kind: 'revoked' })
    expect(store.get('wiki')).toBeUndefined()
    // grant 는 사라졌는데 세대는 남아 있고, 해제 자체가 세대를 하나 올렸다.
    expect(store.credentialRevision('wiki')).toBe(afterLogin + 1)

    // 재로그인이 해제 세대보다 위에서 시작한다 — 소비자가 두 상태를 구분할 수 있다.
    store.put('wiki', secretGrant('wiki:pat@v2'))
    expect(store.credentialRevision('wiki')).toBe(afterLogin + 2)
  })

  // 부팅 복원은 **네 축을 전부** 초기화한다. 하나라도 남으면 이전 실행의 판단이 새 실행으로
  // 샌다 — 특히 `verified` 가 남으면 로그인 없이 게이트가 열리고, `expirySettled` 가 남으면
  // 복원된 grant 의 만료 전이가 통째로 건너뛰어진다.
  it('restore 가 grant·verified·revision·만료정착을 함께 비운다', () => {
    const { store } = build(() => NOW, { wiki: secretGrant() })

    store.restore(['wiki'])
    store.markVerified('wiki')
    store.put('wiki', secretGrant())
    expect(store.isVerified('wiki')).toBe(true)
    expect(store.credentialRevision('wiki')).toBeGreaterThan(0)

    store.restore(['wiki'])

    // 기록은 살아 있지만 이번 실행의 인증은 아니다.
    expect(store.get('wiki')).toBeDefined()
    expect(store.isVerified('wiki')).toBe(false)
    expect(store.credentialRevision('wiki')).toBe(0)
  })

  // 선언에 없는 id 는 지우지 않고 흘린다 — 선언이 잠시 빠진 빌드가 재로그인을 강요하지 않도록.
  it('restore 는 선언에 없는 grant 를 싣지 않고 통지만 한다', () => {
    const orphans: string[] = []
    const vault = createVault(fakeSecretStore())
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence({ gone: secretGrant('gone:pat@v1') }),
      vault,
      clock: () => NOW,
      onOrphan: (authId) => orphans.push(authId)
    })

    store.restore(['wiki'])

    expect(store.get('gone')).toBeUndefined()
    expect(orphans).toEqual(['gone'])
  })

  // 만료 정착은 **1회성**이다. 두 번째 호출이 다시 true 를 내면 호출자(runtime)가 같은 전이로
  // credential-effective change 를 두 번 방출한다.
  it('settleExpiry 는 첫 관측에서만 전이한다', () => {
    const { store } = build(() => NOW, { wiki: secretGrant('wiki:pat@v1', NOW - 1) })
    store.restore(['wiki'])

    expect(store.settleExpiry('wiki')).toBe(true)
    const settled = store.credentialRevision('wiki')

    expect(store.settleExpiry('wiki')).toBe(false)
    expect(store.credentialRevision('wiki')).toBe(settled)
  })

  // `markExpired` 와 `settleExpiry` 는 **같은 정착 집합**을 본다. 두 지점이 각자 기준을 가지면
  // 요청이 도는 사이 시계가 지난 경우가 양쪽에서 접혀 전이가 통째로 사라진다(0188 r6).
  it('settleExpiry 로 정착한 뒤의 markExpired 는 세대를 더 올리지 않는다', () => {
    const { store } = build(() => NOW, { wiki: secretGrant('wiki:pat@v1', NOW - 1) })
    store.restore(['wiki'])
    store.markVerified('wiki')

    expect(store.settleExpiry('wiki')).toBe(true)
    const settled = store.credentialRevision('wiki')

    expect(store.markExpired('wiki')).toEqual({ credentialChanged: false, snapshotChanged: false })
    expect(store.credentialRevision('wiki')).toBe(settled)
  })

  // 이미 정착된 grant 라도 **확인은 풀린다** — 401 을 봤는데 `verified` 를 남기면 게이트가 열린
  // 채로 남는다. 그래서 `verified` 해제가 정착 조기 반환보다 앞이다.
  it('이미 정착된 grant 의 markExpired 도 verified 는 푼다', () => {
    const { store } = build(() => NOW, { wiki: secretGrant('wiki:pat@v1', NOW - 1) })
    store.restore(['wiki'])

    expect(store.settleExpiry('wiki')).toBe(true)
    store.markVerified('wiki')
    expect(store.isVerified('wiki')).toBe(true)

    expect(store.markExpired('wiki')).toEqual({ credentialChanged: false, snapshotChanged: true })
    expect(store.isVerified('wiki')).toBe(false)
  })

  // 401 은 **요청을 보낸 그 값**에 대한 판정이다. 요청이 도는 사이 재인증했다면 그 판정은 이미
  // 없는 값에 대한 것이고 새 값을 내릴 근거가 못 된다(0188 r8 — 부팅 복원 probe 에서 실측).
  it('markExpired 는 세대가 어긋나면 아무것도 하지 않는다', () => {
    const { store, vault } = build()
    store.restore(['wiki'])
    // restore 의 고아 sweep 이 끝난 뒤에 심는다 — 앞에 두면 아무 grant 도 안 가리켜 쓸려나간다.
    vault.set('wiki:pat@v1', 'value', { kind: 'pat', createdAt: 1 })
    store.put('wiki', secretGrant())
    const stale = store.credentialRevision('wiki') - 1

    expect(store.markExpired('wiki', stale)).toEqual({
      credentialChanged: false,
      snapshotChanged: false
    })
    expect(store.isVerified('wiki')).toBe(true)
    expect(store.status('wiki')).toBe('valid')
  })

  // 재로그인은 만료 정착을 **푼다.** 안 풀면 새 자격증명이 나중에 자연 만료돼도 이미 정착됐다고
  // 판단해 전이를 건너뛴다 — 만료인데 화면은 연결됨으로 남는다.
  it('put 이 만료 정착을 해제한다', () => {
    const { store, vault } = build(() => NOW, { wiki: secretGrant('wiki:pat@v1', NOW - 1) })
    store.restore(['wiki'])
    // sweep 뒤에 심는다 — 아직 어떤 grant 도 이 키를 가리키지 않기 때문이다.
    vault.set('wiki:pat@v2', 'value', { kind: 'pat', createdAt: 1 })
    vault.set('wiki:pat@v3', 'value', { kind: 'pat', createdAt: 1 })

    expect(store.settleExpiry('wiki')).toBe(true)

    // 새 자격증명 — 만료 없음.
    store.put('wiki', secretGrant('wiki:pat@v2'))
    expect(store.status('wiki')).toBe('valid')

    // 이 값이 나중에 만료되면 전이가 다시 일어나야 한다.
    store.put('wiki', secretGrant('wiki:pat@v3', NOW - 1))
    expect(store.settleExpiry('wiki')).toBe(true)
  })

  // 확인은 grant 가 있을 때만 성립한다 — 없는 authId 를 확인됨으로 만들면 게이트가 근거 없이
  // 열린다.
  it('grant 없는 authId 는 markVerified 로도 확인되지 않는다', () => {
    const { store } = build()
    store.restore(['wiki'])

    store.markVerified('wiki')

    expect(store.isVerified('wiki')).toBe(false)
  })

  // 해제 실패는 **아무것도 바꾸지 않는다**(fail-closed). 영속이 성립하지 않았는데 메모리만
  // 지우면 화면은 '해제됨' 인데 재시작하면 연결이 되살아난다.
  it('영속이 실패하면 해제는 상태를 건드리지 않는다', () => {
    const vault = createVault(fakeSecretStore())
    const store = new AuthStore({
      persistence: {
        load: () => ({ records: { wiki: secretGrant() }, authoritative: true }),
        save: () => false
      },
      vault,
      clock: () => NOW
    })
    store.restore(['wiki'])
    store.markVerified('wiki')

    expect(store.revoke('wiki')).toEqual({ kind: 'failed' })
    expect(store.get('wiki')).toBeDefined()
    expect(store.isVerified('wiki')).toBe(true)
    expect(store.credentialRevision('wiki')).toBe(0)
  })

  // 부팅 sweep 은 **아무 grant 도 가리키지 않는 vault 자리**만 치운다. 살아 있는 grant 의 키를
  // 지우면 vault 값은 복구되지 않는다.
  it('restore 가 참조되지 않는 vault 키만 쓸어낸다', () => {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    vault.set('wiki:pat@v2', 'live', { kind: 'pat', createdAt: 1 })
    vault.set('wiki:pat@v1', 'orphan', { kind: 'pat', createdAt: 1 })

    const store = new AuthStore({
      persistence: createMemoryGrantPersistence({ wiki: secretGrant('wiki:pat@v2') }),
      vault,
      clock: () => NOW
    })
    store.restore(['wiki'])

    expect(vault.names()).toEqual(['wiki:pat@v2'])
  })

  // grant 저장소를 끝까지 읽지 못했으면 sweep 을 **건너뛴다** — 빈/부분 맵을 없음의 증거로
  // 읽으면 멀쩡한 secret 을 부팅 한 번에 통째로 지운다(0188 r9).
  it('grant 를 다 읽지 못하면 sweep 을 건너뛴다', () => {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    vault.set('wiki:pat@v1', 'value', { kind: 'pat', createdAt: 1 })
    let skipped = 0

    const store = new AuthStore({
      persistence: { load: () => ({ records: {}, authoritative: false }), save: () => true },
      vault,
      clock: () => NOW,
      onSweepSkipped: () => (skipped += 1)
    })
    store.restore(['wiki'])

    expect(skipped).toBe(1)
    expect(vault.names()).toEqual(['wiki:pat@v1'])
  })
})
