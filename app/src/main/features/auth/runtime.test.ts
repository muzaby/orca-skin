// AuthRuntime — change 분류와 재인증 롤백 (0188 AC6·AC7).
//
// 이 두 계약이 무너지면 증상이 원인에서 멀어진다:
//   · `credentialChanged` 오발행 → 화면만 바뀌었는데 Harness cache 가 비고 도구 revision 이 오른다
//   · 재인증 실패 롤백 없음 → 실패 한 번이 멀쩡히 살아 있던 연결을 끊는다

import { describe, expect, it } from 'vitest'
import type { AuthChange, AuthDefinition, AuthenticatedResponse, Grant } from '../../contracts/auth'
import { createVault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { createMemoryGrantPersistence, type GrantPersistencePort } from './store'
import { createAuthRuntime } from './runtime'
import { patSpec, FIELD_SECRET } from './specs/credential'

const BEARER = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const

function fakeSecretStore(): SecretStorePort {
  const map = new Map<string, string>()
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key)
  }
}

// 만료가 붙은 grant 를 만들기 위한 고정 시각.
const TOKEN_EXPIRES_AT = 50_000

const WIKI: AuthDefinition = {
  id: 'wiki',
  label: 'Wiki',
  origin: 'https://wiki.example.corp',
  probe: { path: '/rest/api/user/current' },
  methods: [patSpec({ label: 'PAT', fieldLabel: '개인 액세스 토큰', present: BEARER })]
}

function build(probeOk: () => boolean): {
  runtime: ReturnType<typeof createAuthRuntime>['runtime']
  secretReader: ReturnType<typeof createAuthRuntime>['secretReader']
  changes: AuthChange[]
} {
  const response = (): AuthenticatedResponse => ({
    ok: probeOk(),
    status: probeOk() ? 200 : 401,
    finalUrl: probeOk()
      ? 'https://wiki.example.corp/rest/api/user/current'
      : 'https://adfs.example.corp/adfs/ls',
    headers: {},
    body: ''
  })
  const created = createAuthRuntime({
    definitions: [WIKI],
    persistence: createMemoryGrantPersistence(),
    vault: createVault(fakeSecretStore()),
    fetchImpl: (async () =>
      new Response(response().body, { status: response().status })) as unknown as typeof fetch,
    clock: () => 1_000
  })
  // probe 는 실제 전송을 타므로 여기서는 stub 응답으로 대체한다 — 판정 규칙(2xx + origin 복귀)
  // 자체는 `login.test.ts`·`policy.test.ts` 가 잠근다.
  const changes: AuthChange[] = []
  created.runtime.subscribe((change) => changes.push(change))
  return { runtime: created.runtime, secretReader: created.secretReader, changes }
}

// 만료 있는 token grant 를 심어 둔 runtime. `login` 은 `secret` grant 를 만들므로 만료
// 시나리오는 persistence 에 token grant 를 직접 seed 해 복원 경로로 만든다.
function buildWithClock(clock: () => number): {
  runtime: ReturnType<typeof createAuthRuntime>['runtime']
  changes: AuthChange[]
} {
  const secrets = fakeSecretStore()
  const vault = createVault(secrets)
  vault.set('wiki:pat', 'value', { kind: 'pat', createdAt: 0, expiresAt: TOKEN_EXPIRES_AT })
  const created = createAuthRuntime({
    definitions: [WIKI],
    persistence: createMemoryGrantPersistence({
      wiki: {
        kind: 'token',
        vaultKey: 'wiki:pat',
        authKind: 'pat',
        createdAt: 0,
        expiresAt: TOKEN_EXPIRES_AT
      }
    }),
    vault,
    fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
    clock
  })
  const changes: AuthChange[] = []
  created.runtime.subscribe((change) => changes.push(change))
  return { runtime: created.runtime, changes }
}

describe('AuthChange 분류 (AC6)', () => {
  it('입력 폼은 step 이다 — credential 변화가 아니다', async () => {
    const { runtime, changes } = build(() => true)

    await runtime.login('wiki', 'pat')

    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'step' })
    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(0)
  })

  it('credential commit 은 snapshot·credentialChanged:true 이고 revision 을 올린다', async () => {
    const { runtime, changes } = build(() => true)

    await runtime.login('wiki', 'pat', { [FIELD_SECRET]: 'value' })

    const snapshots = changes.filter((change) => change.kind === 'snapshot')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      authId: 'wiki',
      cause: 'credential-committed',
      credentialChanged: true
    })
    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(1)
  })

  it('같은 상태를 다시 읽어도 revision 이 오르지 않는다', async () => {
    const { runtime } = build(() => true)
    await runtime.login('wiki', 'pat', { [FIELD_SECRET]: 'value' })

    const first = runtime.bind('wiki').snapshot().credentialRevision
    runtime.bind('wiki').snapshot()
    runtime.bind('wiki').snapshot()

    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(first)
  })

  it('resume 성공은 verified 만 바꾼다 — credentialChanged:false', async () => {
    const { runtime, changes } = build(() => true)
    await runtime.login('wiki', 'pat', { [FIELD_SECRET]: 'value' })
    const revision = runtime.bind('wiki').snapshot().credentialRevision
    changes.length = 0

    // 이미 verified 이므로 resume 은 조기 반환한다 — 그래도 계약은 "verified 는 실행 credential
    // 변화가 아니다" 이다. revoke → 재로그인 없이 그 성질을 보려면 cause 매핑을 본다.
    await runtime.resume('wiki')

    expect(changes.filter((c) => c.kind === 'snapshot' && c.credentialChanged)).toHaveLength(0)
    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(revision)
  })

  it('revoke 는 credentialChanged:true 다', async () => {
    const { runtime, changes } = build(() => true)
    await runtime.login('wiki', 'pat', { [FIELD_SECRET]: 'value' })
    changes.length = 0

    runtime.revoke('wiki')

    expect(changes.some((c) => c.kind === 'snapshot' && c.cause === 'revoked')).toBe(true)
    expect(changes.filter((c) => c.kind === 'snapshot' && c.credentialChanged)).toHaveLength(1)
  })

  it('grant 가 없는 revoke 는 아무 snapshot 도 내지 않는다', () => {
    const { runtime, changes } = build(() => true)

    runtime.revoke('wiki')

    expect(changes.filter((c) => c.kind === 'snapshot')).toHaveLength(0)
  })
})

// r3 — 시계 만료는 **관측 지점 어디서든 한 번만** 정착해야 하고, 그때 `credentialChanged` 와
// `credentialRevision` 이 **같은 사실을 말해야** 한다. r2 는 `markExpired` 의 조기 반환에 기대
// revision 을 올리지 않아, 소비자가 이벤트는 받고 revision 으로는 아무 변화도 못 봤다.
describe('시계 기반 만료의 1회 정착 (r3)', () => {
  it('만료가 verified 를 걷어낸다 — 게이트가 열린 채로 남지 않는다', async () => {
    let now = 1_000
    const { runtime } = buildWithClock(() => now)
    // 복원 grant 를 probe 로 확인해 실제로 verified 상태를 만든다(게이트가 열리는 조건).
    await runtime.resume('wiki')
    expect(runtime.bind('wiki').snapshot().verified).toBe(true)
    const before = runtime.bind('wiki').snapshot().credentialRevision

    now = TOKEN_EXPIRES_AT + 1
    const after = runtime.bind('wiki').snapshot()

    expect(after.status).toBe('expired')
    expect(after.verified).toBe(false)
    // 이벤트와 revision 이 같은 사실을 말한다.
    expect(after.credentialRevision).toBeGreaterThan(before)
  })

  it('여러 번 읽어도 한 번만 정착한다 — revision 이 계속 오르지 않는다', () => {
    let now = 1_000
    const { runtime, changes } = buildWithClock(() => now)
    now = TOKEN_EXPIRES_AT + 1

    const first = runtime.bind('wiki').snapshot().credentialRevision
    runtime.bind('wiki').snapshot()
    runtime.bind('wiki').snapshot()

    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(first)
    expect(changes.filter((c) => c.kind === 'snapshot' && c.cause === 'expired')).toHaveLength(1)
  })

  it('만료 change 는 credentialChanged:true 다 — 도구 회수와 cache 무효화가 걸린다', () => {
    let now = 1_000
    const { runtime, changes } = buildWithClock(() => now)
    changes.length = 0
    now = TOKEN_EXPIRES_AT + 1

    runtime.bind('wiki').snapshot()

    const expired = changes.filter((c) => c.kind === 'snapshot' && c.cause === 'expired')
    expect(expired).toHaveLength(1)
    expect(expired[0]).toMatchObject({ credentialChanged: true })
  })

  it('요청 경로에서도 정착한다 — 거부만 하고 상태를 남기지 않던 자리', async () => {
    let now = 1_000
    const { runtime, changes } = buildWithClock(() => now)
    changes.length = 0
    now = TOKEN_EXPIRES_AT + 1

    // 정책이 요청을 거부한다. 그 거부가 곧 상태 전이여야 downstream 이 따라온다.
    await expect(runtime.bind('wiki').request({ path: '/rest' })).rejects.toThrow()

    expect(changes.filter((c) => c.kind === 'snapshot' && c.cause === 'expired')).toHaveLength(1)
    expect(runtime.bind('wiki').snapshot().verified).toBe(false)
  })
})

describe('재인증 롤백 (AC7)', () => {
  it('실패한 재인증은 기존 grant·vault 값·revision 을 보존한다', async () => {
    let ok = true
    const { runtime, secretReader } = build(() => ok)
    await runtime.login('wiki', 'pat', { [FIELD_SECRET]: 'good' })
    const before = runtime.bind('wiki').snapshot()
    expect(secretReader.read('wiki')).toBe('good')

    ok = false
    const step = await runtime.reauth('wiki', 'pat')
    await runtime.continue('wiki', { [FIELD_SECRET]: 'bad' })

    expect(step.kind).toBe('input-required')
    const after = runtime.bind('wiki').snapshot()
    expect(after.status).toBe('valid')
    expect(after.verified).toBe(true)
    // 실패한 재인증은 실행 credential 을 바꾸지 않았다 — Harness cache 를 비울 이유가 없다.
    expect(after.credentialRevision).toBe(before.credentialRevision)
    // 이전 값이 살아 있다 — 0181 은 여기서 vault 를 덮어쓴 뒤 지워 복구 불가였다.
    expect(secretReader.read('wiki')).toBe('good')
  })

  it('성공한 재인증은 값과 revision 을 교체한다', async () => {
    const { runtime, secretReader } = build(() => true)
    await runtime.login('wiki', 'pat', { [FIELD_SECRET]: 'first' })
    const before = runtime.bind('wiki').snapshot().credentialRevision

    await runtime.reauth('wiki', 'pat')
    await runtime.continue('wiki', { [FIELD_SECRET]: 'second' })

    expect(secretReader.read('wiki')).toBe('second')
    expect(runtime.bind('wiki').snapshot().credentialRevision).toBeGreaterThan(before)
  })
})

// r4 — 한 번의 강등은 **한 번만** 통지돼야 한다. r3 은 `resume()` 실패 경로가 요청 경로와
// 무관하게 항상 `onSnapshot('expired')` 를 냈다. probe 가 401 이면 요청 경로가 이미 강등하고
// 통지했으므로 같은 사실이 두 번 나갔고, 두 번째는 `markExpired` 가 조기 반환해 revision 이
// 그대로였다 — `credentialChanged:true` 인데 세대는 안 오르는 유령 이벤트다. 그것이 Harness
// cache 를 한 번 더 비우고 부팅 방송 상한을 `1 + K`(0187 D2) 에서 `1 + 2K` 로 늘렸다.
describe('강등 통지는 실제 전이를 따른다 (r4)', () => {
  // 복원된 미확인 grant — `restorable()` 을 만족해 resume 이 실제로 probe 를 낸다.
  function buildRestorable(probeStatus: number): {
    runtime: ReturnType<typeof createAuthRuntime>['runtime']
    changes: AuthChange[]
  } {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'value', { kind: 'pat', createdAt: 0 })
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => new Response('', { status: probeStatus })) as unknown as typeof fetch,
      clock: () => 1_000
    })
    const changes: AuthChange[] = []
    created.runtime.subscribe((change) => changes.push(change))
    return { runtime: created.runtime, changes }
  }

  const credentialChanges = (changes: AuthChange[]): AuthChange[] =>
    changes.filter((change) => change.kind === 'snapshot' && change.credentialChanged)

  it('401 probe 로 실패한 resume 은 credential-effective change 를 한 번만 낸다', async () => {
    const { runtime, changes } = buildRestorable(401)

    await runtime.resume('wiki')

    // r3 은 여기서 2건('unauthorized' + 'expired')이 나갔고 둘 다 revision 이 같았다.
    expect(credentialChanges(changes)).toHaveLength(1)
    expect(credentialChanges(changes)[0]).toMatchObject({ cause: 'unauthorized' })
    expect(runtime.bind('wiki').snapshot().status).toBe('expired')
    expect(runtime.bind('wiki').snapshot().verified).toBe(false)
  })

  it('401 이 아닌 probe 실패는 resume 이 유일한 전이 지점이다 — 통지가 사라지지 않는다', async () => {
    const { runtime, changes } = buildRestorable(500)

    await runtime.resume('wiki')

    expect(credentialChanges(changes)).toHaveLength(1)
    expect(credentialChanges(changes)[0]).toMatchObject({ cause: 'expired' })
    expect(runtime.bind('wiki').snapshot().status).toBe('expired')
  })

  it('credential-effective change 마다 revision 이 실제로 오른다', async () => {
    const { runtime, changes } = buildRestorable(401)

    await runtime.resume('wiki')

    // 유령 이벤트가 있으면 "change 수 > revision 증가분" 이 된다.
    const revisions = changes
      .filter((change) => change.kind === 'snapshot' && change.credentialChanged)
      .map((change) => (change.kind === 'snapshot' ? change.snapshot.credentialRevision : -1))
    expect(new Set(revisions).size).toBe(revisions.length)
    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(revisions.length)
  })

  it('동시 401 두 건은 상태를 한 번만 바꾸고 방송도 한 번만 한다', async () => {
    // r4 의 같은 이름 테스트는 두 번째 요청을 **보내지 않았다** — 이미 만료된 grant 라
    // `resume()` 이 조기 반환했다. 여기서는 실제로 두 요청을 동시에 띄운다.
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'value', { kind: 'pat', createdAt: 0 })
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let started = 0
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => {
        started += 1
        await gate
        return new Response('', { status: 401 })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })
    const changes: AuthChange[] = []
    created.runtime.subscribe((change) => changes.push(change))
    const auth = created.runtime.bind('wiki')

    const both = Promise.all([
      auth.request({ path: '/a' }).catch(() => undefined),
      auth.request({ path: '/b' }).catch(() => undefined)
    ])
    // 둘 다 실제로 떠 있는 상태에서 401 을 함께 받게 한다.
    await Promise.resolve()
    expect(started).toBe(2)
    release?.()
    await both

    // 상태 변화는 한 번뿐이다 → 방송도 한 번. r4 는 두 번째에도 방송했다.
    const snapshots = changes.filter((change) => change.kind === 'snapshot')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({ cause: 'unauthorized', credentialChanged: true })
    expect(auth.snapshot().credentialRevision).toBe(1)
  })
})

// r5 — 후보 자격증명은 확인이 끝날 때까지 **전역에 존재하지 않는다**. r4 까지는 probe 전에
// store·vault 에 커밋해 두고 실패하면 되돌렸는데, 되돌림이 원리적으로 불완전했다:
// probe 왕복 동안 후보가 전역 노출됐고, 후보의 401 이 낸 강등 이벤트는 상태를 되돌려도
// 취소되지 않아 Plugin 도구가 회수된 채로 남았다.
describe('후보 자격증명 staging (r5)', () => {
  const PROBE_401 = 401
  const PROBE_OK = 200

  function buildForLogin(probeStatus: number): {
    runtime: ReturnType<typeof createAuthRuntime>['runtime']
    secretReader: ReturnType<typeof createAuthRuntime>['secretReader']
    changes: AuthChange[]
    observed: { secret: string | null; revision: number }[]
  } {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    const observed: { secret: string | null; revision: number }[] = []
    const created: ReturnType<typeof createAuthRuntime> = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      // probe 가 나가는 순간의 **전역 상태**를 기록한다 — 다른 소비자가 보는 것과 같다.
      fetchImpl: (async () => {
        observed.push({
          secret: created.secretReader.read('wiki'),
          revision: created.runtime.bind('wiki').snapshot().credentialRevision
        })
        return new Response('', { status: probeStatus })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })
    const changes: AuthChange[] = []
    created.runtime.subscribe((change) => changes.push(change))
    return {
      runtime: created.runtime,
      secretReader: created.secretReader,
      changes,
      observed
    }
  }

  it('probe 중에도 전역에는 이전 자격증명만 보인다', async () => {
    const { runtime, observed } = buildForLogin(PROBE_401)

    await runtime.reauth('wiki', 'pat')
    await runtime.continue('wiki', { [FIELD_SECRET]: 'bad' })

    // r4 는 여기서 후보값 'bad' 와 올라간 revision 이 관측됐다.
    expect(observed).toHaveLength(1)
    expect(observed[0]?.secret).toBe('good')
    expect(observed[0]?.revision).toBe(0)
  })

  it('거부된 재인증은 이전 자격증명을 남기고 강등 이벤트를 내지 않는다', async () => {
    const { runtime, secretReader, changes } = buildForLogin(PROBE_401)

    await runtime.reauth('wiki', 'pat')
    changes.length = 0
    await runtime.continue('wiki', { [FIELD_SECRET]: 'bad' })

    expect(secretReader.read('wiki')).toBe('good')
    const snapshot = runtime.bind('wiki').snapshot()
    expect(snapshot.status).toBe('valid')
    expect(snapshot.credentialRevision).toBe(0)
    // **핵심**: 후보의 401 이 강등 이벤트로 새어 나가면 Plugin 도구가 회수된 채로 남는다.
    expect(changes.filter((c) => c.kind === 'snapshot')).toHaveLength(0)
  })

  it('거부된 재인증 뒤에도 자연 만료가 정상적으로 정착한다', async () => {
    // r5 의 같은 이름 테스트는 첫 `resume()` 이 401 을 받아 grant 를 **미리 만료시켰다** —
    // 그래서 "재인증 실패가 만료 정착을 오염시키는가" 를 전혀 묻지 못했다(r6 리뷰 §1).
    // 여기서는 probe 를 성공시켜 정상 verified 상태를 만든 뒤, **재인증만** 실패시킨다.
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0, expiresAt: TOKEN_EXPIRES_AT })
    let now = 1_000
    let probeStatus = 200
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: {
          kind: 'token',
          vaultKey: 'wiki:pat',
          authKind: 'pat',
          createdAt: 0,
          expiresAt: TOKEN_EXPIRES_AT
        }
      }),
      vault,
      fetchImpl: (async () => new Response('', { status: probeStatus })) as unknown as typeof fetch,
      clock: () => now
    })
    await created.runtime.resume('wiki')
    expect(created.runtime.bind('wiki').snapshot().verified).toBe(true)
    const before = created.runtime.bind('wiki').snapshot().credentialRevision

    // 재인증 실패 — 후보는 거부되고 기존 grant 는 그대로여야 한다.
    probeStatus = 401
    await created.runtime.reauth('wiki', 'pat')
    await created.runtime.continue('wiki', { [FIELD_SECRET]: 'bad' })
    expect(created.runtime.bind('wiki').snapshot().status).toBe('valid')

    // 그 뒤 자연 만료가 정상적으로 한 번 정착해야 한다.
    now = TOKEN_EXPIRES_AT + 1
    const after = created.runtime.bind('wiki').snapshot()

    expect(after.status).toBe('expired')
    expect(after.verified).toBe(false)
    expect(after.credentialRevision).toBeGreaterThan(before)
  })

  it('probe 중 해제하면 후보가 커밋되지 않는다 — 해제한 Auth 가 되살아나지 않는다', async () => {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => {
        await gate
        return new Response('', { status: 200 })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })

    await created.runtime.reauth('wiki', 'pat')
    const pending = created.runtime.continue('wiki', { [FIELD_SECRET]: 'next' })
    await Promise.resolve()
    // probe 가 도는 동안 사용자가 [연결 해제] 를 누른다.
    created.runtime.revoke('wiki')
    release?.()
    await pending

    // r5 는 probe 가 200 이면 무조건 커밋해서 해제한 Auth 가 되살아났다.
    expect(created.runtime.bind('wiki').snapshot().status).toBe('none')
    expect(created.secretReader.read('wiki')).toBeNull()
  })

  it('겹친 두 재인증에서 늦게 끝난 옛 후보가 새 후보를 덮지 않는다', async () => {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    const gates: (() => void)[] = []
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => {
        await new Promise<void>((resolve) => gates.push(resolve))
        return new Response('', { status: 200 })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })

    await created.runtime.reauth('wiki', 'pat')
    const first = created.runtime.continue('wiki', { [FIELD_SECRET]: 'first' })
    await Promise.resolve()
    const second = created.runtime.continue('wiki', { [FIELD_SECRET]: 'second' })
    await Promise.resolve()
    // 두 번째가 먼저 끝나고 첫 번째가 나중에 끝난다.
    gates[1]?.()
    await second
    gates[0]?.()
    await first

    // r5 는 늦게 끝난 'first' 가 이겼다.
    expect(created.secretReader.read('wiki')).toBe('second')
    expect(created.runtime.bind('wiki').snapshot().credentialRevision).toBe(1)
  })

  it('vault 쓰기가 실패하면 이전 값이 남고 커밋되지 않는다', async () => {
    const backing = fakeSecretStore()
    let failNext = false
    const guarded: SecretStorePort = {
      get: backing.get,
      set: (key, value) => {
        // 메타 키 쓰기에서 실패시킨다. `vault.set` 은 메타를 먼저 쓰므로 값 키는 손대기 전이다.
        if (failNext && key.endsWith('#meta')) throw new Error('safeStorage unavailable')
        backing.set(key, value)
      },
      delete: backing.delete
    }
    const vault = createVault(guarded)
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000
    })

    await created.runtime.reauth('wiki', 'pat')
    failNext = true
    await created.runtime.continue('wiki', { [FIELD_SECRET]: 'next' })

    // 쓰기 실패는 로그인 실패다 — 값도 세대도 그대로여야 한다.
    expect(created.secretReader.read('wiki')).toBe('good')
    expect(created.runtime.bind('wiki').snapshot().credentialRevision).toBe(0)
  })

  it('확인에 성공해야 vault 와 store 가 바뀐다', async () => {
    const { runtime, secretReader } = buildForLogin(PROBE_OK)

    await runtime.reauth('wiki', 'pat')
    await runtime.continue('wiki', { [FIELD_SECRET]: 'next' })

    expect(secretReader.read('wiki')).toBe('next')
    expect(runtime.bind('wiki').snapshot().credentialRevision).toBe(1)
  })
})

// ── 자격증명 교체의 원자성과 superseded 격리 (r7 → r8) ───────────────────────
//
// r7 은 확인된 값을 staged 에 쓴 뒤 고정 키로 promote 하고, 그 다음 grant 를 저장했다.
// 그 사이의 창이 실측으로 재현됐다 — grant 저장이 실패하면 **vault=새 값 / 영속 grant=옛 값**.
// 게다가 r7 의 테스트는 그 상태를 단언하지 않았고("refresh 실패" 테스트는 PAT 전용 선언에
// OAuth 실행기를 주입해 **token 경로를 아예 실행하지 않았다**) 통과했다.
//
// r8 은 교체를 **포인터 교체**로 바꿨다. 아래 테스트는 전부 production 경로(`createAuthRuntime`)
// 를 그대로 태우고, 실패·크래시 지점마다 "옛 값 전체" 또는 "새 값 전체" 중 하나만 관측되는지
// 본다. 중간 상태가 하나라도 관측되면 실패다.
describe('자격증명 교체 원자성 · superseded 격리 (r8)', () => {
  function fakeStore(): ReturnType<typeof fakeSecretStore> & { raw: Map<string, string> } {
    const map = new Map<string, string>()
    return {
      get: (k) => map.get(k),
      set: (k, v) => void map.set(k, v),
      delete: (k) => void map.delete(k),
      raw: map
    }
  }

  // 실패를 특정 키에만 거는 SecretStore. 세대 키는 이름이 매번 달라지므로 접미사로 고른다.
  function guarded(
    backing: SecretStorePort,
    shouldFail: () => (key: string) => boolean
  ): SecretStorePort {
    return {
      get: backing.get,
      set: (key, value) => {
        if (shouldFail()(key)) throw new Error('safeStorage unavailable')
        backing.set(key, value)
      },
      delete: backing.delete
    }
  }

  // OAuth token 방식 선언 — access + refresh 두 키를 한 번에 가는 유일한 경로다.
  const GATEWAY: AuthDefinition = {
    id: 'gw',
    label: '게이트웨이',
    origin: 'https://gw.example.corp',
    probe: { path: '/api/me' },
    methods: [
      {
        kind: 'oauth',
        label: 'OAuth',
        present: BEARER,
        authorize: async () => ({
          url: 'https://gw.example.corp/authorize',
          redirect: { kind: 'loopback' as const, port: 0 },
          exchange: async () => ({ token: 'unused' })
        })
      }
    ]
  }

  const OLD_ACCESS = {
    kind: 'token' as const,
    vaultKey: 'gw:oauth',
    refreshKey: 'gw:oauth#refresh'
  }

  // OAuth 실행기가 실제로 불렸는지 세는 카운터. r7 의 실패 원인이 "테스트가 그 경로를 아예
  // 실행하지 않았다" 였으므로, 경로 진입 자체를 단언한다.
  let beginCalls = 0

  function tokenDeployment(options: {
    store: SecretStorePort
    persistence?: GrantPersistencePort
    token?: { token: string; refreshToken?: string }
  }): ReturnType<typeof createAuthRuntime> {
    const vault = createVault(options.store)
    return createAuthRuntime({
      definitions: [GATEWAY],
      persistence:
        options.persistence ??
        createMemoryGrantPersistence({ gw: { ...OLD_ACCESS, authKind: 'oauth', createdAt: 0 } }),
      vault,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000,
      oauth: {
        begin: async () => {
          beginCalls += 1
          return {
            kind: 'token' as const,
            token: options.token ?? { token: 'new-access', refreshToken: 'new-refresh' }
          }
        },
        complete: async () => ({
          kind: 'failed' as const,
          reason: 'cancelled' as const,
          message: ''
        })
      }
    })
  }

  // grant 포인터를 따라 읽는다 — 세대 키 이름을 테스트가 알 필요가 없다.
  function secretsVia(
    runtime: ReturnType<typeof createAuthRuntime>['runtime'],
    persistence: GrantPersistencePort,
    vault: ReturnType<typeof createVault>
  ): { access: string | null; refresh: string | null } {
    void runtime
    const grant = persistence.load().records['gw']
    if (!grant || grant.kind !== 'token') return { access: null, refresh: null }
    return {
      access: vault.get(grant.vaultKey),
      refresh: grant.refreshKey ? vault.get(grant.refreshKey) : null
    }
  }

  it('refresh 키 쓰기가 실패하면 access·refresh 모두 이전 값 그대로다', async () => {
    // r6 은 access 를 먼저 정식 키에 써서 `new-access + old-refresh` 를 남겼다. r8 은 둘 다
    // 아직 아무도 가리키지 않는 새 키에 쓰므로, 실패해도 grant 는 옛 키 쌍을 계속 가리킨다.
    const backing = fakeStore()
    let failRefresh = false
    const store = guarded(backing, () => (key) => failRefresh && key.includes('#refresh'))
    const vault = createVault(store)
    vault.set('gw:oauth', 'old-access', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth#refresh', 'old-refresh', { kind: 'oauth', createdAt: 0 })
    const persistence = createMemoryGrantPersistence({
      gw: { ...OLD_ACCESS, authKind: 'oauth', createdAt: 0 }
    })
    const created = tokenDeployment({ store, persistence })
    failRefresh = true
    beginCalls = 0

    const step = await created.runtime.login('gw', 'oauth')

    // **token 경로를 실제로 지났는가** — r7 테스트는 PAT 전용 선언에 OAuth 실행기를 주입해
    // 이 지점에 도달하지 못한 채 통과했다.
    expect(beginCalls).toBe(1)
    // 실패했으므로 로그인은 성립하지 않았고, 두 키는 통째로 이전 값이다.
    expect(step.kind).toBe('failed')
    expect(secretsVia(created.runtime, persistence, vault)).toEqual({
      access: 'old-access',
      refresh: 'old-refresh'
    })
  })

  it('grant 영속이 실패해도 이전 secret 은 파괴되지 않는다', async () => {
    // **정책은 실패 신호가 아니라 연산이 정한다** (r9). 추가·교체는 degrade-open 이다 —
    // 이번 프로세스는 새 값으로 동작하고, 재시작하면 직전 정상 상태로 돌아갈 뿐이라 잃는 것이
    // 없다. r8 은 throw 와 `false` 에 서로 다른 정책(거부 / degrade)을 붙여 같은 조건이 두
    // 갈래로 처리됐다 — store 가 throw 를 `false` 로 정규화해 하나로 합쳤다.
    const backing = fakeStore()
    const vault = createVault(backing)
    vault.set('gw:oauth', 'old-access', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth#refresh', 'old-refresh', { kind: 'oauth', createdAt: 0 })
    const persisted: Record<string, Grant> = {
      gw: { ...OLD_ACCESS, authKind: 'oauth', createdAt: 0 }
    }
    const created = tokenDeployment({
      store: backing,
      persistence: {
        load: () => ({ records: { ...persisted }, authoritative: true }),
        save: () => {
          throw new Error('disk full')
        }
      }
    })

    await created.runtime.login('gw', 'oauth')

    // 핵심 불변식 — **옛 자격증명이 살아 있다.** r7 은 여기서 `new-access` 가 관측됐다.
    expect(vault.get('gw:oauth')).toBe('old-access')
    expect(vault.get('gw:oauth#refresh')).toBe('old-refresh')
    // 재시작하면 영속된 옛 grant 가 그 키를 그대로 가리킨다 — 매달린 포인터가 생기지 않는다.
    const rebooted = tokenDeployment({
      store: backing,
      persistence: {
        load: () => ({ records: { ...persisted }, authoritative: true }),
        save: () => true
      }
    })
    expect(rebooted.secretReader.read('gw')).toBe('old-access')
  })

  it('영속이 메모리로만 됐으면 새 값을 쓰되 이전 키를 지우지 않는다', async () => {
    // production adapter 는 store 파일을 못 열면 메모리로 내려앉는다. 그 상태를 "저장 성공" 으로
    // 접으면 옛 키를 지워, 재시작 후 옛 grant 가 **아무것도 가리키지 않는** 상태가 된다.
    const backing = fakeStore()
    const vault = createVault(backing)
    vault.set('gw:oauth', 'old-access', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth#refresh', 'old-refresh', { kind: 'oauth', createdAt: 0 })
    const created = tokenDeployment({
      store: backing,
      persistence: {
        load: () => ({
          records: { gw: { ...OLD_ACCESS, authKind: 'oauth', createdAt: 0 } },
          authoritative: true
        }),
        // degraded — 내구 저장 실패를 **던지지 않고 보고**한다.
        save: () => false
      }
    })

    expect(await created.runtime.login('gw', 'oauth')).toEqual({ kind: 'done', providerId: 'gw' })
    // 이번 프로세스는 새 값으로 동작한다.
    expect(created.secretReader.read('gw')).toBe('new-access')
    // 재시작하면 옛 grant 가 돌아온다 — 그 키가 살아 있어야 한다.
    expect(vault.get('gw:oauth')).toBe('old-access')
    expect(vault.get('gw:oauth#refresh')).toBe('old-refresh')
  })

  it('커밋 뒤 크래시해도 재부팅이 새 자격증명으로 열린다', async () => {
    const backing = fakeStore()
    const persisted: Record<string, Grant> = {
      gw: { ...OLD_ACCESS, authKind: 'oauth', createdAt: 0 }
    }
    const persistence: GrantPersistencePort = {
      load: () => ({ records: { ...persisted }, authoritative: true }),
      save: (next) => {
        Object.assign(persisted, next)
        return true
      }
    }
    const vault = createVault(backing)
    vault.set('gw:oauth', 'old-access', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth#refresh', 'old-refresh', { kind: 'oauth', createdAt: 0 })
    const created = tokenDeployment({ store: backing, persistence })
    await created.runtime.login('gw', 'oauth')

    // 크래시 = 프로세스 교체. 같은 디스크 위에 런타임을 새로 만든다.
    const rebooted = tokenDeployment({ store: backing, persistence })
    expect(rebooted.secretReader.read('gw')).toBe('new-access')
    expect(secretsVia(rebooted.runtime, persistence, createVault(backing))).toEqual({
      access: 'new-access',
      refresh: 'new-refresh'
    })
  })

  it('커밋 전 크래시하면 재부팅이 이전 자격증명으로 열리고 고아 키가 정리된다', async () => {
    // **크래시는 catch 가 돌지 않는 실패다.** 정상 실패 경로는 방금 쓴 새 키를 스스로 지우므로
    // (위 테스트) 고아가 남지 않는다. 프로세스가 그 사이에 죽으면 정리가 돌지 못한다 — 그
    // 상태를 그대로 만들어 두고 부팅시킨다: 새 세대 키는 vault 에 있고 grant 는 옛 키를 가리킨다.
    const backing = fakeStore()
    const vault = createVault(backing)
    vault.set('gw:oauth', 'old-access', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth#refresh', 'old-refresh', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth@deadbeef', 'new-access', { kind: 'oauth', createdAt: 0 })
    vault.set('gw:oauth#refresh@deadbeef', 'new-refresh', { kind: 'oauth', createdAt: 0 })
    const persisted: Record<string, Grant> = {
      gw: { ...OLD_ACCESS, authKind: 'oauth', createdAt: 0 }
    }

    const rebooted = tokenDeployment({
      store: backing,
      persistence: {
        load: () => ({ records: { ...persisted }, authoritative: true }),
        save: () => true
      }
    })

    // 커밋되지 않은 값은 절대 쓰이지 않는다 — 부팅이 옛 자격증명으로 열린다.
    expect(rebooted.secretReader.read('gw')).toBe('old-access')
    expect(vault.get('gw:oauth#refresh')).toBe('old-refresh')
    // 아무도 가리키지 않는 자리는 부팅 sweep 이 치운다.
    expect([...backing.raw.keys()].filter((k) => k.includes('@'))).toEqual([])
  })

  it('늦게 끝난 시도가 실패해도 화면 단계를 되돌리지 않는다', async () => {
    // r7 은 probe **성공** 뒤에만 세대를 확인해서, 늦게 끝난 옛 시도의 401 이 이미 성공한 새
    // 로그인 위에 거부 폼을 다시 열었다.
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    const gates: ((ok: boolean) => void)[] = []
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => {
        const ok = await new Promise<boolean>((resolve) => gates.push(resolve))
        return new Response('', { status: ok ? 200 : 401 })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })

    await created.runtime.reauth('wiki', 'pat')
    const first = created.runtime.continue('wiki', { [FIELD_SECRET]: 'first' })
    await Promise.resolve()
    const second = created.runtime.continue('wiki', { [FIELD_SECRET]: 'second' })
    await Promise.resolve()
    gates[1]?.(true)
    await second
    const afterSecond = created.runtime.currentStep()
    gates[0]?.(false)
    await first

    expect(created.runtime.currentStep()).toEqual(afterSecond)
    expect(created.secretReader.read('wiki')).toBe('second')
  })

  it('probe 가 401 로 끝나도 그 사이 해제했으면 거부 폼이 열리지 않는다', async () => {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    let release: ((ok: boolean) => void) | undefined
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () =>
        new Response('', { status: (await gate) ? 200 : 401 })) as unknown as typeof fetch,
      clock: () => 1_000
    })

    await created.runtime.reauth('wiki', 'pat')
    const pending = created.runtime.continue('wiki', { [FIELD_SECRET]: 'next' })
    await Promise.resolve()
    created.runtime.revoke('wiki')
    release?.(false)
    await pending

    // r7 은 `status=none` 인데 `currentStep=input-required` 인 모순 상태를 만들었다.
    expect(created.runtime.currentStep()).toBeNull()
    expect(created.runtime.bind('wiki').snapshot().status).toBe('none')
  })

  it('probe 중 해제한 뒤 거부 폼이 다시 열리지 않는다', async () => {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'good', { kind: 'pat', createdAt: 0 })
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault,
      fetchImpl: (async () => {
        await gate
        return new Response('', { status: 200 })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })

    await created.runtime.reauth('wiki', 'pat')
    const pending = created.runtime.continue('wiki', { [FIELD_SECRET]: 'next' })
    await Promise.resolve()
    created.runtime.revoke('wiki')
    release?.()
    await pending

    expect(created.runtime.currentStep()).toBeNull()
    expect(created.runtime.bind('wiki').snapshot().status).toBe('none')
  })

  it('부팅 복원 중 사용자가 재인증하면 옛 probe 실패가 새 자격증명을 강등하지 않는다', async () => {
    // resume 은 새 시도를 열지 않으므로 사용자의 로그인을 무효화하지 않는다. 반대 방향은
    // 막아야 한다 — 세대 확인이 없으면 **옛 자격증명이 받은 401** 이 방금 성공한 새 자격증명을
    // `expired` 로 강등한다. 사용자가 막 로그인했는데 화면이 곧바로 만료로 뒤집힌다.
    let release: ((ok: boolean) => void) | undefined
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    let firstProbe = true
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
      }),
      vault: (() => {
        const v = createVault(fakeSecretStore())
        v.set('wiki:pat', 'old', { kind: 'pat', createdAt: 0 })
        return v
      })(),
      fetchImpl: (async () => {
        if (firstProbe) {
          firstProbe = false
          return new Response('', { status: (await gate) ? 200 : 401 })
        }
        return new Response('', { status: 200 })
      }) as unknown as typeof fetch,
      clock: () => 1_000
    })

    const resuming = created.runtime.resume('wiki')
    await Promise.resolve()
    // 사용자가 그 사이 재인증을 끝냈다.
    await created.runtime.reauth('wiki', 'pat')
    await created.runtime.continue('wiki', { [FIELD_SECRET]: 'fresh' })
    // 옛 자격증명의 probe 가 뒤늦게 401 로 끝난다.
    release?.(false)
    await resuming

    expect(created.secretReader.read('wiki')).toBe('fresh')
    const snapshot = created.runtime.bind('wiki').snapshot()
    expect(snapshot.status).toBe('valid')
    expect(snapshot.verified).toBe(true)
    expect(created.runtime.currentStep()).toBeNull()
  })

  it('늦게 끝난 OAuth code-required 가 pending 을 되살리지 않는다', async () => {
    // `absorb` 의 중간 분기도 세대를 봐야 한다 — 안 보면 해제한 Auth 가 code 입력 대기로 되살아난다.
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const created = createAuthRuntime({
      definitions: [GATEWAY],
      persistence: createMemoryGrantPersistence(),
      vault: createVault(fakeSecretStore()),
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000,
      oauth: {
        begin: async () => {
          await gate
          return { kind: 'code-required' as const, url: 'https://gw.example.corp/authorize' }
        },
        complete: async () => ({
          kind: 'failed' as const,
          reason: 'cancelled' as const,
          message: ''
        })
      }
    })

    const pending = created.runtime.login('gw', 'oauth')
    await Promise.resolve()
    created.runtime.revoke('gw')
    release?.()
    await pending

    expect(created.runtime.currentStep()).toBeNull()
    expect(created.runtime.bind('gw').snapshot().status).toBe('none')
  })
})

// ── 영속 장애에서의 데이터 보존과 명시적 해제 (r9) ────────────────────────────
//
// r8 은 두 곳에서 "실패를 정상으로 오인" 했다:
//   ① grant 파일을 못 읽으면 빈 맵이 오는데, sweep 이 그것을 **권위 있는 없음**으로 읽고
//      멀쩡한 vault secret 을 전부 지웠다(grant 파일만 손상된 흔한 경우).
//   ② `revoke()` 가 영속 결과를 버리고 무조건 성공을 발행했다 — session grant 는 vault 값도
//      없어 아무것도 사라지지 않은 채 화면만 '해제됨' 이 됐다.
//
// 둘 다 **실패 방향이 데이터 손실 또는 되살아남**이라 degrade 로 접을 수 없다.
describe('영속 장애에서의 보존과 해제 (r9)', () => {
  const SESSION_AUTH: AuthDefinition = {
    id: 'portal',
    label: '포털',
    origin: 'https://portal.example.corp',
    probe: { path: '/api/me' },
    methods: [
      {
        kind: 'browser-session',
        label: 'SSO',
        config: {
          sessionGroup: 'corp',
          allowedOrigins: ['https://portal.example.corp'],
          loginUrl: 'https://portal.example.corp/login',
          doneUrlPrefix: 'https://portal.example.corp/'
        }
      }
    ]
  }

  function seededVault(): { vault: ReturnType<typeof createVault>; raw: Map<string, string> } {
    const raw = new Map<string, string>()
    const vault = createVault({
      get: (k) => raw.get(k),
      set: (k, v) => void raw.set(k, v),
      delete: (k) => void raw.delete(k)
    })
    vault.set('wiki:pat', 'live-secret', { kind: 'pat', createdAt: 0 })
    return { vault, raw }
  }

  it('grant 저장소를 못 읽으면 vault 를 쓸어내지 않는다', async () => {
    // grant 파일만 손상되고 secret 파일은 멀쩡한 경우. 부팅 한 번에 자격증명이 사라지면
    // 복구 경로가 없다 — sweep 은 위생 작업이므로 미루는 쪽이 항상 옳다.
    const { vault } = seededVault()
    let skipped = 0
    const created = createAuthRuntime({
      definitions: [WIKI],
      // 파일을 못 열었다 = "아는 것이 없다" 이지 "없다" 가 아니다.
      persistence: { load: () => ({ records: {}, authoritative: false }), save: () => false },
      vault,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000,
      onSweepSkipped: () => {
        skipped += 1
      }
    })
    void created

    expect(vault.get('wiki:pat')).toBe('live-secret')
    expect(skipped).toBe(1)
  })

  it('레코드를 하나라도 버렸으면 sweep 을 건너뛴다', () => {
    // 버린 레코드의 `vaultKey` 는 읽을 수 없다 — 남은 것만으로 고아를 판정하면 그 값이 지워진다.
    const { vault } = seededVault()
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: {
        load: () => ({ records: {}, authoritative: false }),
        save: () => true
      },
      vault,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000
    })
    void created

    expect(vault.get('wiki:pat')).toBe('live-secret')
  })

  it('끝까지 읽었으면 고아를 정상적으로 치운다', () => {
    // 위 두 케이스가 sweep 을 통째로 껐는지 확인한다 — 껐다면 이 테스트가 실패한다.
    const { vault } = seededVault()
    createAuthRuntime({
      definitions: [WIKI],
      persistence: { load: () => ({ records: {}, authoritative: true }), save: () => true },
      vault,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000
    })

    expect(vault.get('wiki:pat')).toBeNull()
  })

  it('session grant 해제는 저장에 실패하면 성공을 발행하지 않는다', async () => {
    // session grant 는 vault 값이 없어 "지울 것" 자체가 없다. 저장이 실패했는데 성공을
    // 발행하면 화면만 해제되고 디스크의 grant 는 남아, **재시작하면 연결이 되살아난다**.
    const cleared: string[] = []
    const created = createAuthRuntime({
      definitions: [SESSION_AUTH],
      persistence: {
        load: () => ({
          records: {
            portal: {
              kind: 'session',
              sessionGroup: 'corp',
              authKind: 'browser-session',
              createdAt: 0
            }
          },
          authoritative: true
        }),
        save: () => false
      },
      vault: createVault(fakeSecretStore()),
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000,
      sessions: {
        register: () => undefined,
        acquire: () => 'handle',
        openLoginWindow: async () => ({ finalUrl: '' }),
        send: async () => ({ status: 200, headers: {}, body: '' }),
        clear: async (_handle, opts) => void cleared.push(opts.scope)
      }
    })
    const changes: AuthChange[] = []
    created.runtime.subscribe((change) => changes.push(change))

    expect(() => created.runtime.revoke('portal')).toThrow()
    // 상태는 그대로여야 한다 — 사용자가 "끊었다" 고 믿게 두지 않는다.
    expect(created.runtime.bind('portal').snapshot().status).toBe('valid')
    expect(changes.filter((c) => c.kind === 'snapshot' && c.cause === 'revoked')).toHaveLength(0)
    // 실패한 해제는 cookie 도 건드리지 않는다.
    expect(cleared).toEqual([])
  })

  it('해제가 성립하면 session cookie 도 함께 비운다', () => {
    // grant 만 지우면 서버 쪽 로그인은 살아 있다 — 같은 그룹의 다른 연결이 그 쿠키로 통과한다.
    const cleared: { scope: string; origin?: string }[] = []
    const created = createAuthRuntime({
      definitions: [SESSION_AUTH],
      persistence: createMemoryGrantPersistence({
        portal: { kind: 'session', sessionGroup: 'corp', authKind: 'browser-session', createdAt: 0 }
      }),
      vault: createVault(fakeSecretStore()),
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000,
      sessions: {
        register: () => undefined,
        acquire: () => 'handle',
        openLoginWindow: async () => ({ finalUrl: '' }),
        send: async () => ({ status: 200, headers: {}, body: '' }),
        clear: async (_handle, opts) => void cleared.push(opts)
      }
    })

    created.runtime.revoke('portal')

    expect(created.runtime.bind('portal').snapshot().status).toBe('none')
    // 공유 그룹을 통째로 비우지 않는다 — 같은 그룹의 다른 연결이 끊긴다.
    expect(cleared).toEqual([{ scope: 'origin', origin: 'https://portal.example.corp' }])
  })

  it('degraded 재인증 뒤 해제해도 재시작이 옛 자격증명을 되살리지 않는다', async () => {
    // degrade-open(교체)과 fail-closed(해제)가 한 줄기에서 만나는 자리다.
    const raw = new Map<string, string>()
    const backing = {
      get: (k: string) => raw.get(k),
      set: (k: string, v: string) => void raw.set(k, v),
      delete: (k: string) => void raw.delete(k)
    }
    const vault = createVault(backing)
    vault.set('wiki:pat', 'old', { kind: 'pat', createdAt: 0 })
    const persisted: Record<string, Grant> = {
      wiki: { kind: 'secret', vaultKey: 'wiki:pat', authKind: 'pat', createdAt: 0 }
    }
    let durable = false
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: {
        load: () => ({ records: { ...persisted }, authoritative: true }),
        save: (next) => {
          if (!durable) return false
          for (const key of Object.keys(persisted)) delete persisted[key]
          Object.assign(persisted, next)
          return true
        }
      },
      vault,
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000
    })

    // degraded 재인증 — 이번 프로세스는 새 값을 쓰지만 옛 키는 남는다.
    await created.runtime.reauth('wiki', 'pat')
    await created.runtime.continue('wiki', { [FIELD_SECRET]: 'fresh' })
    expect(vault.get('wiki:pat')).toBe('old')

    // 이 상태에서 해제가 저장되지 않으면 실패해야 한다.
    expect(() => created.runtime.revoke('wiki')).toThrow()
    expect(created.runtime.bind('wiki').snapshot().status).toBe('valid')

    // 저장이 회복되면 해제가 성립하고, 재시작해도 옛 자격증명이 돌아오지 않는다.
    durable = true
    created.runtime.revoke('wiki')
    const rebooted = createAuthRuntime({
      definitions: [WIKI],
      persistence: {
        load: () => ({ records: { ...persisted }, authoritative: true }),
        save: () => true
      },
      vault: createVault(backing),
      fetchImpl: (async () => new Response('', { status: 200 })) as unknown as typeof fetch,
      clock: () => 1_000
    })
    expect(rebooted.runtime.bind('wiki').snapshot().status).toBe('none')
    expect(rebooted.secretReader.read('wiki')).toBeNull()
  })
})

describe('요청 중 자연 만료 (r6)', () => {
  it('요청 도중 만료되고 401 이 오면 그 자리에서 전이가 정착한다', async () => {
    const vault = createVault(fakeSecretStore())
    vault.set('wiki:pat', 'value', { kind: 'pat', createdAt: 0, expiresAt: TOKEN_EXPIRES_AT })
    let now = 1_000
    const created = createAuthRuntime({
      definitions: [WIKI],
      persistence: createMemoryGrantPersistence({
        wiki: {
          kind: 'token',
          vaultKey: 'wiki:pat',
          authKind: 'pat',
          createdAt: 0,
          expiresAt: TOKEN_EXPIRES_AT
        }
      }),
      vault,
      // 요청이 나가는 동안 시계가 만료를 지난다.
      fetchImpl: (async () => {
        now = TOKEN_EXPIRES_AT + 1
        return new Response('', { status: 401 })
      }) as unknown as typeof fetch,
      clock: () => now
    })
    const changes: AuthChange[] = []
    created.runtime.subscribe((change) => changes.push(change))
    const auth = created.runtime.bind('wiki')

    await auth.request({ path: '/a' }).catch(() => undefined)

    // r5 는 여기서 change 0건이었고 revision 도 0이었다 — 전이가 다음 snapshot 까지 미뤄졌다.
    const snapshots = changes.filter((change) => change.kind === 'snapshot')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({ credentialChanged: true })
    expect(auth.snapshot().credentialRevision).toBe(1)
    expect(auth.snapshot().verified).toBe(false)
  })
})

describe('describe / tryBind', () => {
  it('secret 없는 설명만 돌려준다', () => {
    const { runtime } = build(() => true)

    const descriptor = runtime.describe('wiki')

    expect(descriptor).toMatchObject({ authId: 'wiki', label: 'Wiki', origin: WIKI.origin })
    expect(descriptor.methods.map((method) => method.kind)).toEqual(['pat'])
    expect(JSON.stringify(descriptor)).not.toContain('compose')
  })

  it('미등록 id 는 tryBind 가 null 이다', () => {
    const { runtime } = build(() => true)
    expect(runtime.tryBind('nope')).toBeNull()
  })
})
