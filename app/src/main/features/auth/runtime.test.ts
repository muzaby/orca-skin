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
