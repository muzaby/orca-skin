// AuthRuntime — change 분류와 재인증 롤백 (0188 AC6·AC7).
//
// 이 두 계약이 무너지면 증상이 원인에서 멀어진다:
//   · `credentialChanged` 오발행 → 화면만 바뀌었는데 Harness cache 가 비고 도구 revision 이 오른다
//   · 재인증 실패 롤백 없음 → 실패 한 번이 멀쩡히 살아 있던 연결을 끊는다

import { describe, expect, it } from 'vitest'
import type { AuthChange, AuthDefinition, AuthenticatedResponse } from '../../contracts/auth'
import { createVault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { createMemoryGrantPersistence } from './store'
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

// r6 — 요청이 도는 동안 시계가 지나 만료되는 경우. r5 는 `markExpired` 가 `expiresAt <= now` 만
// 보고 "이미 정착됨" 으로 접어, 전이가 다음 `snapshot()` 까지 미뤄졌다.
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
