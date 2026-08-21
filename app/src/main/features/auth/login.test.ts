import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthDefinition, AuthenticatedResponse, TokenValue } from '../../contracts/auth'
import { createVault, type Vault } from '../../infra/vault'
import type { SecretStorePort } from '../../infra/config/secret-store-port'
import { LoginService, type LoginDeps } from './login'
import { AuthRegistry } from './registry'
import { createMemoryGrantPersistence, AuthStore, type GrantPersistencePort } from './store'
import {
  apiKeySpec,
  passwordSpec,
  patSpec,
  FIELD_SECRET,
  FIELD_PASSWORD,
  FIELD_USERNAME
} from './specs/credential'

// safeStorage 를 대신하는 fake — 봉인 자체는 `infra/config/crypto.ts` 의 책임이라 여기서는
// 저장·삭제·열거 의미론만 재현한다.
function fakeSecretStore(): SecretStorePort & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    get: (name) => raw.get(name),
    set: (name, plain) => {
      raw.set(name, plain)
    },
    delete: (name) => {
      raw.delete(name)
    }
  }
}

const BEARER = { location: 'header', name: 'Authorization', scheme: 'bearer' } as const

// `AuthDefinition.probe` 를 실행하는 통로의 fake. 어느 provider 가 확인을 받았는지 `seen` 에 쌓아
// "물어봤는가" 자체를 단언한다 — 확인 없이 통과하던 것이 이번 변경이 고치는 버그다.
//
// 응답은 실제 판정 규칙을 그대로 재현한다: `ok` 뿐 아니라 **최종 URL 이 provider origin 으로
// 돌아왔는지**까지 본다(미인증 SSO 는 IdP 로그인 폼을 200 으로 준다).
function probeApi(
  ok: boolean,
  seen: string[] = [],
  origins: Record<string, string> = {}
): (authId: string, req: { path: string }) => Promise<AuthenticatedResponse> {
  return async (authId) => {
    {
      seen.push(authId)
      const origin = origins[authId] ?? PROBE_ORIGINS[authId] ?? 'https://unknown.invalid'
      return {
        ok,
        status: ok ? 200 : 401,
        finalUrl: ok ? `${origin}/probe` : 'https://adfs.example.corp/adfs/ls',
        headers: {},
        body: ''
      }
    }
  }
}

const PROBE_ORIGINS: Record<string, string> = {
  sso: 'https://portal.example.corp',
  wiki: 'https://wiki.example.corp',
  gw: 'https://gw.example.corp',
  'key-gate': 'https://gw.example.corp'
}

function gateway(): AuthDefinition {
  return {
    id: 'gw',
    label: '게이트웨이',
    origin: 'https://gw.example.corp',
    methods: [
      apiKeySpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER }),
      passwordSpec({ label: 'ID/비밀번호', present: BEARER })
    ]
  }
}

interface Harness {
  login: LoginService
  store: AuthStore
  vault: Vault
  persistence: GrantPersistencePort
  secrets: ReturnType<typeof fakeSecretStore>
  // grant 포인터를 따라 실제 secret 을 읽는다. **고정 키 이름을 단언하지 않는다** (r8) —
  // 자격증명은 로그인마다 새 세대 키에 앉고, 계약은 "grant 가 가리키는 자리에 그 값이 있다" 다.
  secretOf(authId: string): string | null
  refreshOf(authId: string): string | null
}

function harness(
  providers: AuthDefinition[] = [gateway()],
  // probe 통로. 미주입이면 확인 없이 통과한다(`LoginDeps.request` 의 기본 의미).
  request?: LoginDeps['request'],
  // 최초 로그인 경로를 실물로 태우기 위한 구멍 — `SessionAuthenticator.login` 은 `AuthResult` 를
  // 돌려주므로 token 갈래(`absorbToken`)를 임의의 `TokenValue` 로 열 수 있다.
  session?: LoginDeps['session']
): Harness {
  const secrets = fakeSecretStore()
  const vault = createVault(secrets)
  const persistence = createMemoryGrantPersistence()
  const registry = new AuthRegistry(providers)
  const store = new AuthStore({ persistence, vault, clock: () => 1_000 })
  store.restore(registry.list().map((p) => p.id))
  const login = new LoginService({
    registry,
    store,
    vault,
    clock: () => 1_000,
    ...(request ? { request } : {}),
    ...(session ? { session } : {})
  })
  const keyOf = (authId: string, which: 'value' | 'refresh'): string | null => {
    const grant = store.get(authId)
    if (!grant || grant.kind === 'session') return null
    if (which === 'refresh') return grant.kind === 'token' ? (grant.refreshKey ?? null) : null
    return grant.vaultKey
  }
  return {
    login,
    store,
    vault,
    persistence,
    secrets,
    secretOf: (authId) => {
      const key = keyOf(authId, 'value')
      return key === null ? null : vault.get(key)
    },
    refreshOf: (authId) => {
      const key = keyOf(authId, 'refresh')
      return key === null ? null : vault.get(key)
    }
  }
}

describe('LoginService — 코어 3종 (AC2)', () => {
  it('코어 3종이 vault 왕복 후 valid 로 복원된다', async () => {
    const h = harness([
      {
        id: 'wiki',
        label: 'Wiki',
        origin: 'https://wiki.example.corp',
        methods: [
          patSpec({ label: 'PAT', fieldLabel: '개인 액세스 토큰', present: BEARER }),
          apiKeySpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER }),
          passwordSpec({ label: 'ID/비밀번호', present: BEARER })
        ]
      }
    ])

    for (const [authKind, input, expected] of [
      ['pat', { [FIELD_SECRET]: ' pat-value ' }, 'pat-value'],
      ['api-key', { [FIELD_SECRET]: 'key-value' }, 'key-value'],
      ['password', { [FIELD_USERNAME]: 'kim', [FIELD_PASSWORD]: ' pw ' }, 'kim: pw ']
    ] as const) {
      const step = await h.login.begin('wiki', authKind, input)
      expect(step).toEqual({ kind: 'done', providerId: 'wiki' })
      expect(h.store.status('wiki')).toBe('valid')
      expect(h.secretOf('wiki')).toBe(expected)
    }

    // 재시작 흉내 — 같은 영속·vault 위에 store 를 새로 만들면 grant 가 그대로 복원된다.
    const restored = new AuthStore({ persistence: h.persistence, vault: h.vault })
    restored.restore(['wiki'])
    expect(restored.status('wiki')).toBe('valid')
    // 마지막으로 성공한 방식이 활성 방식이다.
    expect(restored.authKind('wiki')).toBe('password')
    expect(restored.secret('wiki')).toBe('kim: pw ')
  })

  it('입력 없이 시작하면 필드 선언을 되돌려주고 vault 는 그대로다', async () => {
    const h = harness()
    const step = await h.login.begin('gw')
    expect(step).toEqual({
      kind: 'input-required',
      providerId: 'gw',
      authKind: 'api-key',
      fields: [{ name: FIELD_SECRET, label: 'API 키', type: 'password', required: true }]
    })
    expect(h.secrets.raw.size).toBe(0)
    expect(h.store.status('gw')).toBe('none')
  })

  it('compose 거부는 같은 폼을 사유와 함께 다시 낸다 (vault 미기록)', async () => {
    const h = harness()
    await h.login.begin('gw', 'password')
    const step = await h.login.continue('gw', { [FIELD_USERNAME]: 'a:b', [FIELD_PASSWORD]: 'pw' })
    expect(step).toMatchObject({
      kind: 'input-required',
      authKind: 'password',
      message: '아이디에 콜론(:)을 쓸 수 없습니다'
    })
    expect(h.secrets.raw.size).toBe(0)
  })

  it('등록되지 않은 provider·방식은 명시적으로 실패한다', async () => {
    const h = harness()
    expect(await h.login.begin('nope')).toMatchObject({
      kind: 'failed',
      reason: 'unknown_provider'
    })
    expect(await h.login.begin('gw', 'oauth')).toMatchObject({
      kind: 'failed',
      reason: 'unknown_auth_kind'
    })
  })
})

describe('LoginService — 복수 AuthMethod (AC5)', () => {
  it('복수 AuthMethod 중 고른 방식으로 인증한다', async () => {
    const h = harness()
    // 방식 미지정 = 선언 배열의 첫 방식(api-key).
    expect(await h.login.begin('gw')).toMatchObject({ authKind: 'api-key' })

    const step = await h.login.begin('gw', 'password', {
      [FIELD_USERNAME]: 'kim',
      [FIELD_PASSWORD]: 'pw'
    })
    expect(step).toEqual({ kind: 'done', providerId: 'gw' })
    expect(h.store.authKind('gw')).toBe('password')
    // 고른 방식의 네임스페이스에만 값이 앉는다 — 다른 방식 자리는 비어 있다.
    expect(h.secretOf('gw')).toBe('kim:pw')
    // 방식을 바꾸면 옛 방식의 자리는 남지 않는다 — 포인터가 새 키로 옮겨가고 옛 키는 지워진다.
    expect([...h.secrets.raw.keys()].filter((k) => k.includes('gw:api-key'))).toEqual([])
  })

  it('continue 는 직전에 고른 방식을 이어받는다', async () => {
    const h = harness()
    await h.login.begin('gw', 'password')
    const step = await h.login.continue('gw', {
      [FIELD_USERNAME]: 'kim',
      [FIELD_PASSWORD]: 'pw'
    })
    expect(step).toEqual({ kind: 'done', providerId: 'gw' })
    expect(h.store.authKind('gw')).toBe('password')
  })
})

// `AuthRuntime.reauth` 는 `LoginService.begin` 으로 곧장 라우팅된다 (0190) — 재인증은 기존
// grant 를 남겨둔 채 시작하는 것이고 그것이 `begin` 의 기본 동작이라 별도 메서드가 없다.
describe('LoginService — 재인증 (AC6)', () => {
  let h: Harness
  beforeEach(async () => {
    h = harness()
    await h.login.begin('gw', 'api-key', { [FIELD_SECRET]: 'old-key' })
  })

  it('재인증 실패는 기존 grant 를 보존한다', async () => {
    // 시작만 하고 값을 안 낸다 — 기존 grant 는 살아 있어야 한다.
    expect(await h.login.begin('gw', 'api-key')).toMatchObject({ kind: 'input-required' })
    expect(h.store.status('gw')).toBe('valid')
    expect(h.secretOf('gw')).toBe('old-key')

    // 빈 값으로 거부당해도 마찬가지다.
    await h.login.continue('gw', { [FIELD_SECRET]: '   ' })
    expect(h.store.status('gw')).toBe('valid')
    expect(h.secretOf('gw')).toBe('old-key')
  })

  it('재인증 성공에서만 교체된다', async () => {
    await h.login.begin('gw', 'api-key')
    expect(await h.login.continue('gw', { [FIELD_SECRET]: 'new-key' })).toEqual({
      kind: 'done',
      providerId: 'gw'
    })
    expect(h.secretOf('gw')).toBe('new-key')
    // 옛 세대 키는 교체가 내구 저장으로 성립한 뒤 지워진다 — 쓰이지 않는 secret 이 남지 않는다.
    expect([...h.secrets.raw.keys()].filter((k) => k.includes('gw:api-key')).length).toBe(2)
  })

  it('해제는 grant 와 vault 잔여물을 함께 지운다', () => {
    h.login.revoke('gw')
    expect(h.store.status('gw')).toBe('none')
    expect(h.secretOf('gw')).toBeNull()
    // metadata·index 까지 정리돼 재인증이 깨끗한 상태에서 시작한다.
    expect([...h.secrets.raw.keys()].filter((k) => k.includes('gw:api-key'))).toEqual([])
  })
})

// ── 로그인 시 인증 확인 (probe) ──────────────────────────────────────────────
//
// 값을 사용자가 직접 넣는 방식(api-key·pat·password)은 `compose` 가 **형식만** 본다. 서버가
// 그 값을 받아 주는지는 물어봐야 알 수 있고, 물어보지 않으면 잘못된 PAT 도 곧바로 "연결됨" 이
// 된다 — 실제 실패는 한참 뒤 도구 호출에서 401 로 드러난다.
describe('LoginService — 로그인 시 probe', () => {
  function wiki(probe = true): AuthDefinition {
    return {
      id: 'wiki',
      label: 'Wiki',
      origin: 'https://wiki.example.corp',
      ...(probe ? { probe: { path: '/rest/api/user/current' } } : {}),
      methods: [patSpec({ label: 'PAT', fieldLabel: '개인 액세스 토큰', present: BEARER })]
    }
  }

  function build(
    provider: AuthDefinition,
    request?: ReturnType<typeof probeApi>
  ): Harness & { events: string[] } {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    const persistence = createMemoryGrantPersistence()
    const registry = new AuthRegistry([provider])
    const store = new AuthStore({ persistence, vault, clock: () => 1_000 })
    store.restore(registry.list().map((p) => p.id))
    const events: string[] = []
    const login = new LoginService({
      registry,
      store,
      vault,
      clock: () => 1_000,
      ...(request ? { request } : {}),
      // 0188 — step(화면)과 snapshot(인증 상태)이 갈렸다. 둘을 구분해 담아야 "probe 전에는
      // 아무것도 안 쏜다" 뿐 아니라 **무엇을 쐈는가**까지 단언할 수 있다.
      onStep: () => events.push('step'),
      onSnapshot: (_id, cause) => events.push(`snapshot:${cause}`)
    })
    const secretOf = (authId: string): string | null => {
      const grant = store.get(authId)
      if (!grant || grant.kind === 'session') return null
      return vault.get(grant.vaultKey)
    }
    const refreshOf = (authId: string): string | null => {
      const grant = store.get(authId)
      if (!grant || grant.kind !== 'token' || !grant.refreshKey) return null
      return vault.get(grant.refreshKey)
    }
    return { login, store, vault, persistence, secrets, events, secretOf, refreshOf }
  }

  it('probe 가 통과해야 연결됨이 된다', async () => {
    const seen: string[] = []
    const h = build(wiki(), probeApi(true, seen))
    expect(await h.login.begin('wiki', 'pat', { [FIELD_SECRET]: 'good' })).toEqual({
      kind: 'done',
      providerId: 'wiki'
    })
    expect(seen).toEqual(['wiki'])
    expect(h.store.status('wiki')).toBe('valid')
  })

  it('서버가 거부하면 연결되지 않고 같은 폼으로 돌아온다', async () => {
    const h = build(wiki(), probeApi(false))
    const step = await h.login.begin('wiki', 'pat', { [FIELD_SECRET]: 'bad' })
    expect(step).toMatchObject({ kind: 'input-required', authKind: 'pat' })
    expect((step as { message?: string }).message).toContain('거부')
    // grant 는 남지 않는다 — 화면이 "연결됨" 을 보여선 안 된다.
    expect(h.store.status('wiki')).toBe('none')
    expect(h.vault.get('wiki:pat')).toBeNull()
  })

  // 게이트 깜빡임 회귀: `commit` 이 곧바로 브로드캐스트하면 probe 로 떨어질 자격증명에도
  // renderer 가 한 순간 통과 상태를 받아 메인 화면으로 넘어갔다 되돌아온다.
  it('probe 가 끝나기 전에는 renderer 로 아무것도 쏘지 않는다', async () => {
    const h: Harness & { events: string[] } = build(wiki(), async () => {
      h.events.push('probe')
      return {
        ok: true,
        status: 200,
        finalUrl: 'https://wiki.example.corp/rest/api/user/current',
        headers: {},
        body: ''
      }
    })
    await h.login.begin('wiki', 'pat', { [FIELD_SECRET]: 'good' })
    // probe 가 끝난 **뒤에야** credential commit snapshot 과 `done` step 이 나간다.
    expect(h.events).toEqual(['probe', 'snapshot:credential-committed', 'step'])
  })

  it('probe 미선언이면 왕복 없이 현행대로 저장한다', async () => {
    const seen: string[] = []
    const h = build(wiki(false), probeApi(false, seen))
    expect(await h.login.begin('wiki', 'pat', { [FIELD_SECRET]: 'v' })).toMatchObject({
      kind: 'done'
    })
    expect(seen).toEqual([])
    expect(h.store.status('wiki')).toBe('valid')
  })

  it('실행 통로가 없으면 확인을 건너뛴다 — 선언만으로 잠기지 않는다', async () => {
    const h = build(wiki())
    expect(await h.login.begin('wiki', 'pat', { [FIELD_SECRET]: 'v' })).toMatchObject({
      kind: 'done'
    })
    expect(h.store.status('wiki')).toBe('valid')
  })

  // 0174 실기: 미인증 SSO 는 IdP 로그인 폼을 **200** 으로 준다. status 만 보면 인증됨으로
  // 오독하므로, 체인이 provider origin 으로 돌아왔는지까지 본다.
  it('2xx 라도 체인이 IdP 에 머물면 미인증이다', async () => {
    const h = build(wiki(), async () => ({
      ok: true,
      status: 200,
      finalUrl: 'https://adfs.example.corp/adfs/ls?wa=wsignin1.0',
      headers: {},
      body: '<html>login</html>'
    }))
    expect(await h.login.begin('wiki', 'pat', { [FIELD_SECRET]: 'v' })).toMatchObject({
      kind: 'input-required'
    })
    expect(h.store.status('wiki')).toBe('none')
  })

  // 브라우저 세션·OAuth 도 같은 판정을 받는다 — `doneUrlPrefix` 도달만으로 성공을 선언하지
  // 않는다(로그인 폼이 같은 접두사로 렌더되는 배포가 있다).
  it('브라우저 세션 로그인도 probe 로 확인한다', async () => {
    const gate: AuthDefinition = {
      id: 'sso',
      label: '사내 로그인',
      origin: 'https://portal.example.corp',
      probe: { path: '/api/me' },
      methods: [
        {
          kind: 'browser-session',
          label: '통합 인증',
          config: {
            sessionGroup: 'corp',
            loginUrl: 'https://adfs.example.corp/adfs/ls/',
            doneUrlPrefix: 'https://portal.example.corp/home',
            allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
          }
        }
      ]
    }
    const registry = new AuthRegistry([gate])
    const vault = createVault(fakeSecretStore())
    const store = new AuthStore({ persistence: createMemoryGrantPersistence(), vault })
    store.restore(['sso'])
    const login = new LoginService({
      registry,
      store,
      vault,
      request: probeApi(false),
      session: { login: async () => ({ kind: 'session', sessionGroup: 'corp' }) }
    })
    expect(await login.begin('sso')).toMatchObject({ kind: 'failed', reason: 'probe_failed' })
    expect(store.isVerified('sso')).toBe(false)
    expect(store.status('sso')).toBe('none')
  })
})

// ── 0194 · refresh_token grant ──────────────────────────────────────────────

// refresh 를 구현한 oauth 선언. `authorize` 는 이 경로에서 불리지 않아야 하므로 던지게 둔다 —
// 불리면 그 자체가 결함이다(refresh 는 인가 왕복을 다시 하지 않는다).
function oauthWithRefresh(
  calls: string[],
  refresh?: (refreshToken: string) => Promise<TokenValue>
): AuthDefinition {
  return {
    id: 'wiki',
    label: '위키',
    origin: 'https://wiki.example.corp',
    probe: { path: '/api/me' },
    methods: [
      {
        kind: 'oauth',
        label: 'SSO',
        present: BEARER,
        authorize: () => Promise.reject(new Error('authorize must not run during refresh')),
        ...(refresh
          ? {
              refresh: (token: string) => {
                calls.push(token)
                return refresh(token)
              }
            }
          : {})
      }
    ]
  }
}

// 만료된 token grant 를 심는다. **키 이름을 계약으로 삼지 않는다** — grant 가 가리키는 자리에
// 값이 있다는 것만 세운다(r8 규칙).
function seedExpiredToken(
  h: Harness,
  patch?: { refreshKey?: string | null; refreshExpiresAt?: number; principalId?: string }
): { accessKey: string; refreshKey: string | null } {
  const accessKey = 'old-access@v1'
  const refreshKey = patch?.refreshKey === undefined ? 'old-refresh@v1' : patch.refreshKey
  h.vault.set(accessKey, 'old-access-value', { kind: 'oauth', createdAt: 1 })
  if (refreshKey !== null) {
    h.vault.set(refreshKey, 'old-refresh-value', { kind: 'oauth', createdAt: 1 })
  }
  h.store.put('wiki', {
    kind: 'token',
    vaultKey: accessKey,
    authKind: 'oauth',
    createdAt: 1,
    // clock 이 1_000 이라 이미 만료다 — refresh 를 쓰는 바로 그 형상.
    expiresAt: 500,
    ...(refreshKey !== null ? { refreshKey } : {}),
    ...(patch?.refreshExpiresAt !== undefined ? { refreshExpiresAt: patch.refreshExpiresAt } : {}),
    ...(patch?.principalId !== undefined ? { principalId: patch.principalId } : {})
  })
  return { accessKey, refreshKey }
}

describe('LoginService — refresh (0194)', () => {
  it('새 토큰이 probe 를 통과하면 커밋된다 — access·refresh 둘 다 새 세대 키에', async () => {
    const calls: string[] = []
    const definition = oauthWithRefresh(calls, () =>
      Promise.resolve({ token: 'new-access', refreshToken: 'new-refresh' })
    )
    const h = harness([definition], probeApi(true))
    const seeded = seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    // 선언에 넘어간 것은 **보관돼 있던 refresh token** 이다.
    expect(calls).toEqual(['old-refresh-value'])
    const grant = h.store.get('wiki')
    expect(grant?.kind).toBe('token')
    expect(grant?.kind === 'token' && grant.vaultKey).not.toBe(seeded.accessKey)
    expect(grant?.kind === 'token' && grant.refreshKey).not.toBe(seeded.refreshKey)
    expect(h.secretOf('wiki')).toBe('new-access')
    expect(h.refreshOf('wiki')).toBe('new-refresh')
  })

  it('새 토큰이 probe 를 통과하지 못하면 옛 grant 가 그대로다', async () => {
    const calls: string[] = []
    const definition = oauthWithRefresh(calls, () => Promise.resolve({ token: 'new-access' }))
    const h = harness([definition], probeApi(false))
    const seeded = seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('failed')

    // 아무것도 쓰지 않았다 — 되돌릴 중간 상태가 애초에 생기지 않는다(`settleGrant` r5 계약).
    const grant = h.store.get('wiki')
    expect(grant?.kind === 'token' && grant.vaultKey).toBe(seeded.accessKey)
    expect(h.secretOf('wiki')).toBe('old-access-value')
  })

  it('선언이 refresh 를 구현하지 않으면 unsupported 다', async () => {
    const h = harness([oauthWithRefresh([])], probeApi(true))
    seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('unsupported')
  })

  it('refresh token 이 없으면 부르지 않는다', async () => {
    const calls: string[] = []
    const h = harness(
      [oauthWithRefresh(calls, () => Promise.resolve({ token: 'new' }))],
      probeApi(true)
    )
    seedExpiredToken(h, { refreshKey: null })

    await expect(h.login.refresh('wiki')).resolves.toBe('unsupported')
    expect(calls).toEqual([])
  })

  it('refreshExpiresAt 이 지났으면 부르지 않는다 — 왕복 0회로 재로그인에 넘긴다', async () => {
    const calls: string[] = []
    const h = harness(
      [oauthWithRefresh(calls, () => Promise.resolve({ token: 'new' }))],
      probeApi(true)
    )
    seedExpiredToken(h, { refreshExpiresAt: 900 })

    await expect(h.login.refresh('wiki')).resolves.toBe('unsupported')
    expect(calls).toEqual([])
  })

  it('refreshExpiresAt 이 없으면 시도한다 — 없음은 "모른다" 지 "만료" 가 아니다', async () => {
    const calls: string[] = []
    const h = harness(
      [oauthWithRefresh(calls, () => Promise.resolve({ token: 'new', refreshToken: 'r' }))],
      probeApi(true)
    )
    seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')
    expect(calls).toHaveLength(1)
  })

  it('refreshExpiresAt 이 미래면 시도한다', async () => {
    const calls: string[] = []
    const h = harness(
      [oauthWithRefresh(calls, () => Promise.resolve({ token: 'new', refreshToken: 'r' }))],
      probeApi(true)
    )
    seedExpiredToken(h, { refreshExpiresAt: 9_999 })

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')
    expect(calls).toHaveLength(1)
  })

  it('선언이 던지면 failed 다 — 옛 grant 는 손대지 않는다', async () => {
    const h = harness(
      [oauthWithRefresh([], () => Promise.reject(new Error('idp down')))],
      probeApi(true)
    )
    const seeded = seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('failed')
    expect(h.store.get('wiki')?.kind === 'token' && h.store.get('wiki')).toMatchObject({
      vaultKey: seeded.accessKey
    })
  })

  it('세션 grant 는 대상이 아니다 — refresh 라는 개념이 없다', async () => {
    const calls: string[] = []
    const h = harness([oauthWithRefresh(calls, () => Promise.resolve({ token: 'new' }))])
    h.store.put('wiki', {
      kind: 'session',
      sessionGroup: 'corp',
      authKind: 'browser-session',
      createdAt: 1,
      expiresAt: 500
    })

    await expect(h.login.refresh('wiki')).resolves.toBe('unsupported')
    expect(calls).toEqual([])
  })

  it('세션 교환이 만든 token grant 는 oauth refresh 로 갱신하지 않는다', async () => {
    // `authKind` 가 다르면 자격증명 계보가 다르다 — oauth 선언의 refresh 로 갱신하면 섞인다.
    const calls: string[] = []
    const h = harness([oauthWithRefresh(calls, () => Promise.resolve({ token: 'new' }))])
    h.vault.set('sess-access@v1', 'v', { kind: 'browser-session', createdAt: 1 })
    h.vault.set('sess-refresh@v1', 'r', { kind: 'browser-session', createdAt: 1 })
    h.store.put('wiki', {
      kind: 'token',
      vaultKey: 'sess-access@v1',
      refreshKey: 'sess-refresh@v1',
      authKind: 'browser-session',
      createdAt: 1,
      expiresAt: 500
    })

    await expect(h.login.refresh('wiki')).resolves.toBe('unsupported')
    expect(calls).toEqual([])
  })

  it('등록되지 않은 Auth 는 unsupported 다', async () => {
    const h = harness([oauthWithRefresh([], () => Promise.resolve({ token: 'new' }))])
    await expect(h.login.refresh('nope')).resolves.toBe('unsupported')
  })
})

// ── 0194 r2 · 회전하지 않는 서버의 refresh token 승계 (D-014) ────────────────
//
// RFC 6749 §6 은 새 refresh token 발급을 **선택**으로 둔다. r1 은 응답에 없으면 "refresh token
// 없음" 으로 커밋해 옛 값을 금고에서 지웠고, 그래서 조용한 회복이 첫 성공 이후 사라졌다.
describe('LoginService — refresh 미회전 승계 (0194 D-014)', () => {
  it('응답에 refresh token 이 없으면 옛 값을 새 세대 키로 옮긴다', async () => {
    const calls: string[] = []
    const h = harness(
      [oauthWithRefresh(calls, () => Promise.resolve({ token: 'new-access' }))],
      probeApi(true)
    )
    const seeded = seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    const grant = h.store.get('wiki')
    // 값은 보존되고 자리는 새것이다 — 옛 키를 계속 가리키면 실패 경로가 그 자리를 지운다.
    expect(h.refreshOf('wiki')).toBe('old-refresh-value')
    expect(grant?.kind === 'token' && grant.refreshKey).not.toBe(seeded.refreshKey)
    expect(grant?.kind === 'token' && grant.refreshKey).toBeDefined()
    // 옛 세대는 access·refresh 둘 다 정리됐다.
    expect(h.secrets.raw.has(seeded.accessKey)).toBe(false)
    expect(seeded.refreshKey !== null && h.secrets.raw.has(seeded.refreshKey)).toBe(false)
  })

  it('승계한 뒤에도 다시 갱신할 수 있다 — 회복이 1회용이 아니다', async () => {
    const calls: string[] = []
    const h = harness(
      [oauthWithRefresh(calls, () => Promise.resolve({ token: 'new-access' }))],
      probeApi(true)
    )
    seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')
    // 2회차. r1 은 여기서 `unsupported` 였다 — 로그인 창밖에 길이 없던 자리다.
    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')
    // 두 번 다 **보관하던 같은 값**이 선언으로 나갔다.
    expect(calls).toEqual(['old-refresh-value', 'old-refresh-value'])
  })

  it('승계할 때 옛 만료도 함께 옮긴다 — 값만 옮기면 만료를 잃는다', async () => {
    const h = harness(
      [oauthWithRefresh([], () => Promise.resolve({ token: 'new-access' }))],
      probeApi(true)
    )
    seedExpiredToken(h, { refreshExpiresAt: 9_999 })

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    const grant = h.store.get('wiki')
    expect(grant?.kind === 'token' && grant.refreshExpiresAt).toBe(9_999)
  })

  it('응답이 만료만 새로 주면 그 값이 이긴다 — 회전 없이 만료만 늘리는 서버', async () => {
    const h = harness(
      [
        oauthWithRefresh([], () =>
          Promise.resolve({ token: 'new-access', refreshExpiresAt: 50_000 })
        )
      ],
      probeApi(true)
    )
    seedExpiredToken(h, { refreshExpiresAt: 9_999 })

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    const grant = h.store.get('wiki')
    expect(h.refreshOf('wiki')).toBe('old-refresh-value')
    expect(grant?.kind === 'token' && grant.refreshExpiresAt).toBe(50_000)
  })

  it('회전 응답은 새 값으로 갈아끼우고 만료를 물려받지 않는다', async () => {
    const h = harness(
      [
        oauthWithRefresh([], () =>
          Promise.resolve({ token: 'new-access', refreshToken: 'new-refresh' })
        )
      ],
      probeApi(true)
    )
    seedExpiredToken(h, { refreshExpiresAt: 9_999 })

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    const grant = h.store.get('wiki')
    expect(h.refreshOf('wiki')).toBe('new-refresh')
    // 새 refresh token 의 만료는 **모르는 것**이지 옛 값이 아니다.
    expect(grant?.kind === 'token' && grant.refreshExpiresAt).toBeUndefined()
  })

  it('회전 응답이 만료를 주면 그대로 보관한다', async () => {
    const h = harness(
      [
        oauthWithRefresh([], () =>
          Promise.resolve({ token: 'a', refreshToken: 'r2', refreshExpiresAt: 77_000 })
        )
      ],
      probeApi(true)
    )
    seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    const grant = h.store.get('wiki')
    expect(grant?.kind === 'token' && grant.refreshExpiresAt).toBe(77_000)
  })

  it('probe 가 거부하면 옛 access 와 옛 refresh 가 **둘 다** 그대로 산다', async () => {
    const h = harness(
      [oauthWithRefresh([], () => Promise.resolve({ token: 'new-access' }))],
      probeApi(false)
    )
    const seeded = seedExpiredToken(h)

    await expect(h.login.refresh('wiki')).resolves.toBe('failed')

    const grant = h.store.get('wiki')
    expect(grant?.kind === 'token' && grant.vaultKey).toBe(seeded.accessKey)
    expect(grant?.kind === 'token' && grant.refreshKey).toBe(seeded.refreshKey)
    expect(h.secretOf('wiki')).toBe('old-access-value')
    expect(h.refreshOf('wiki')).toBe('old-refresh-value')
    // 거부 뒤에도 다음 시도가 가능하다.
    expect(h.store.refreshSecret('wiki')).toBe('old-refresh-value')
  })

  it('금고 쓰기가 실패해도 옛 refresh 가 산다 — 되돌리기가 살아 있는 자리를 지우지 않는다', async () => {
    // **이 케이스가 승계 방식을 고른 이유다.** probe 는 통과하고 새 자리에 쓰는 단계에서 죽는
    // 경로다(safeStorage 불가·디스크). `settleGrant` 의 되돌리기는 "새 자격증명이 이름 붙인
    // 자리는 전부 버려도 된다" 를 전제하므로, 옛 refresh 키를 새 자격증명이 같이 가리켰다면
    // 여기서 **살아 있는 grant 의 refresh 자리**가 함께 지워진다.
    const h = harness(
      [oauthWithRefresh([], () => Promise.resolve({ token: 'new-access' }))],
      probeApi(true)
    )
    const seeded = seedExpiredToken(h)
    const inner = h.secrets.set
    h.secrets.set = (name: string, plain: string): void => {
      if (plain === 'new-access') throw new Error('safeStorage down')
      inner(name, plain)
    }

    await expect(h.login.refresh('wiki')).resolves.toBe('failed')

    h.secrets.set = inner
    const grant = h.store.get('wiki')
    expect(grant?.kind === 'token' && grant.refreshKey).toBe(seeded.refreshKey)
    expect(h.refreshOf('wiki')).toBe('old-refresh-value')
    expect(h.secretOf('wiki')).toBe('old-access-value')
    // 다음 시도가 여전히 가능하다 — 회복 능력을 잃지 않았다.
    expect(h.store.refreshSecret('wiki')).toBe('old-refresh-value')
  })
})

// ── 커밋 grant 의 **전체 형상** (0194 r3) ────────────────────────────────────
//
// 위 케이스들은 필드를 **골라서** 단언한다(`grant.refreshKey`·`refreshOf`). 그래서 이름을 적지
// 않은 필드는 커밋에서 빠져도 green 이었다 — D2(`refreshExpiresAt` 쓰기 제거 후 330/330) ·
// D9(짝 조건 제거 후 338/338) · D7(`principalId` 유실이 두 라운드 통과)이 전부 같은 이유다.
//
// 여기서는 grant 를 **통째로** 단언한다. 필드 이름을 몰라도 빠진 필드가 잡히고, 있으면 안 되는
// 필드(승계 금지 `expiresAt`)도 같은 단언이 잡는다. 키 이름은 계약이 아니므로(r8) 새 세대 키는
// `expect.any(String)` 으로 받고 "옛 키와 다르다" 만 따로 단언한다.
function sessionTokenProvider(): AuthDefinition {
  return {
    id: 'wiki',
    label: '위키',
    origin: 'https://wiki.example.corp',
    probe: { path: '/api/me' },
    methods: [
      {
        kind: 'browser-session',
        label: '통합 인증',
        config: {
          sessionGroup: 'corp',
          loginUrl: 'https://adfs.example.corp/adfs/ls/',
          doneUrlPrefix: 'https://wiki.example.corp/home',
          allowedOrigins: ['https://adfs.example.corp', 'https://wiki.example.corp']
        }
      }
    ]
  }
}

describe('LoginService — 커밋 grant 전체 형상 (0194 r3)', () => {
  it('회전 갱신 — 응답이 말한 것 + 옛 grant 에서 승계한 것', async () => {
    const h = harness(
      [
        oauthWithRefresh([], () =>
          Promise.resolve({
            token: 'new-access',
            refreshToken: 'new-refresh',
            expiresAt: 9_000,
            refreshExpiresAt: 77_000
          })
        )
      ],
      probeApi(true)
    )
    // 응답은 신원을 다시 말하지 않는다 — 계정은 갱신으로 바뀌지 않으므로 옛 값이 살아야 한다(D7).
    const seeded = seedExpiredToken(h, { principalId: 'kim@corp' })

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    expect(h.store.get('wiki')).toEqual({
      kind: 'token',
      vaultKey: expect.any(String),
      authKind: 'oauth',
      createdAt: 1_000,
      expiresAt: 9_000,
      refreshKey: expect.any(String),
      refreshExpiresAt: 77_000,
      principalId: 'kim@corp'
    })
    const grant = h.store.get('wiki')
    expect(grant?.kind === 'token' && grant.vaultKey).not.toBe(seeded.accessKey)
    expect(grant?.kind === 'token' && grant.refreshKey).not.toBe(seeded.refreshKey)
  })

  it('미회전 갱신 — 승계는 refresh 쌍과 신원까지다. 옛 `expiresAt` 은 넘어오지 않는다', async () => {
    const h = harness(
      [oauthWithRefresh([], () => Promise.resolve({ token: 'new-access' }))],
      probeApi(true)
    )
    // 심은 grant 의 `expiresAt` 은 500(이미 만료)이다. 그것이 새 access token 에 실리면 갱신
    // 직후 만료로 태어난다 — `markExpired` 가 강등 시점에 `now` 를 못 박기 때문이다.
    seedExpiredToken(h, { refreshExpiresAt: 9_999, principalId: 'kim@corp' })

    await expect(h.login.refresh('wiki')).resolves.toBe('refreshed')

    expect(h.store.get('wiki')).toEqual({
      kind: 'token',
      vaultKey: expect.any(String),
      authKind: 'oauth',
      createdAt: 1_000,
      refreshKey: expect.any(String),
      refreshExpiresAt: 9_999,
      principalId: 'kim@corp'
    })
  })

  it('최초 로그인 — refresh token 이 없으면 `refreshExpiresAt` 도 싣지 않는다 (짝 불변식)', async () => {
    const h = harness([sessionTokenProvider()], probeApi(true), {
      // 응답이 refresh 만료만 주고 refresh token 은 주지 않는다. 짝 조건이 없으면 `refreshKey`
      // 없는 grant 에 만료만 실려 "가리킬 자리 없는 만료" 가 영속된다.
      login: () =>
        Promise.resolve({
          kind: 'token',
          token: {
            token: 'first-access',
            expiresAt: 9_000,
            refreshExpiresAt: 77_000,
            principalId: 'lee@corp'
          }
        })
    })

    await expect(h.login.begin('wiki')).resolves.toMatchObject({ kind: 'done' })

    expect(h.store.get('wiki')).toEqual({
      kind: 'token',
      vaultKey: expect.any(String),
      authKind: 'browser-session',
      createdAt: 1_000,
      expiresAt: 9_000,
      principalId: 'lee@corp'
    })
  })

  it('최초 로그인은 옛 grant 에서 아무것도 승계하지 않는다 — 새 인가다', async () => {
    const h = harness([sessionTokenProvider()], probeApi(true), {
      login: () => Promise.resolve({ kind: 'token', token: { token: 'first-access' } })
    })
    // 옛 grant 에 신원·refresh 쌍이 다 있다. 승계가 갱신 경로를 넘어가면 여기서 되살아난다.
    seedExpiredToken(h, { refreshExpiresAt: 9_999, principalId: 'kim@corp' })

    await expect(h.login.begin('wiki')).resolves.toMatchObject({ kind: 'done' })

    expect(h.store.get('wiki')).toEqual({
      kind: 'token',
      vaultKey: expect.any(String),
      authKind: 'browser-session',
      createdAt: 1_000
    })
  })
})

describe('AuthStore — 상태 판정', () => {
  it('만료된 토큰은 expired 로 강등되고 값이 나가지 않는다', () => {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence(),
      vault,
      clock: () => 5_000
    })
    store.restore(['gw'])
    vault.set('gw:oauth', 'token-value', { kind: 'oauth', createdAt: 0 })
    store.put('gw', {
      kind: 'token',
      vaultKey: 'gw:oauth',
      authKind: 'oauth',
      createdAt: 0,
      expiresAt: 4_000
    })
    expect(store.status('gw')).toBe('expired')
    expect(store.secret('gw')).toBeNull()
  })

  it('복호화 실패는 부재와 구분해 unknown 으로 남는다', () => {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    const store = new AuthStore({ persistence: createMemoryGrantPersistence(), vault })
    store.restore(['gw'])
    vault.set('gw:pat', 'v', { kind: 'pat', createdAt: 0 })
    store.put('gw', { kind: 'secret', vaultKey: 'gw:pat', authKind: 'pat', createdAt: 0 })
    // 값만 사라지고 index 는 남은 상태 = 키체인 잠김.
    secrets.raw.delete('provider:gw:pat')
    expect(store.status('gw')).toBe('unknown')
  })

  it('선언에 없는 grant 는 무시하되 삭제하지 않는다', () => {
    const persistence = createMemoryGrantPersistence({
      ghost: { kind: 'secret', vaultKey: 'ghost:pat', authKind: 'pat', createdAt: 0 }
    })
    const orphans: string[] = []
    const store = new AuthStore({
      persistence,
      vault: createVault(fakeSecretStore()),
      onOrphan: (id) => orphans.push(id)
    })
    store.restore(['gw'])
    expect(orphans).toEqual(['ghost'])
    expect(store.get('ghost')).toBeUndefined()
    // 영속 원본은 건드리지 않는다 — 선언이 돌아오면 재로그인 없이 살아난다.
    expect(Object.keys(persistence.load().records)).toEqual(['ghost'])
  })
})

// ── 회귀: 복원된 grant 는 게이트 통과 근거가 아니다 ──────────────────────────
//
// 사용자 보고 — "구현한 sso provider 로 로그인 성공 시, 해당 provider 의 id 는 영구적으로
// bypass 와 같은 현상". `kind:'session'` grant 는 vault 도 만료도 없어 기록만으로 계속
// `status:'valid'` 라, 게이트가 status 만 보면 재시작 후에도 로그인 화면이 아예 뜨지 않는다.
// 통과 근거는 **이번 실행에서 실제로 로그인했는가**(`isVerified`)로 옮겼다.
describe('AuthStore — 인증 확인은 실행 수명이다', () => {
  const SSO_GRANT = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 0
  } as const

  it('로그인 성공 직후에는 확인이 성립한다', async () => {
    const h = harness()
    await h.login.begin('gw', 'api-key')
    await h.login.continue('gw', { [FIELD_SECRET]: 'k' })
    expect(h.store.status('gw')).toBe('valid')
    expect(h.store.isVerified('gw')).toBe(true)
  })

  it('재시작하면 세션 grant 가 valid 여도 확인은 풀린다 (로그인 화면이 다시 뜬다)', () => {
    const persistence = createMemoryGrantPersistence({ sso: { ...SSO_GRANT } })
    const store = new AuthStore({ persistence, vault: createVault(fakeSecretStore()) })
    store.restore(['sso'])
    // 기록은 살아 있다 — 이것만 보면 예전처럼 게이트가 열렸다.
    expect(store.status('sso')).toBe('valid')
    // 통과 근거는 이쪽이고, 재시작을 넘어오지 않는다.
    expect(store.isVerified('sso')).toBe(false)
  })

  it('해제·401 강등은 확인을 함께 푼다', () => {
    const persistence = createMemoryGrantPersistence()
    const store = new AuthStore({ persistence, vault: createVault(fakeSecretStore()) })
    store.restore(['sso'])

    store.put('sso', { ...SSO_GRANT })
    expect(store.isVerified('sso')).toBe(true)
    store.markExpired('sso')
    expect(store.isVerified('sso')).toBe(false)

    store.put('sso', { ...SSO_GRANT })
    expect(store.isVerified('sso')).toBe(true)
    store.revoke('sso')
    expect(store.isVerified('sso')).toBe(false)
  })
})

// ── 자동 로그인 (resume) ─────────────────────────────────────────────────────
//
// 재시작하면 게이트는 닫혀 있고, `resume()` 이 복원된 자격증명이 아직 유효한지 `AuthDefinition.probe`
// 로 한 번 확인한다. **방식과 무관하게 같은 판정**이다 — 세션은 복원된 쿠키로, 값형은 vault 의
// 값으로 나간다. 2xx + 체인이 provider origin 으로 복귀하면 통과, 아니면 강등이다.
describe('LoginService — 자동 로그인(resume)', () => {
  const SSO_GRANT = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 0
  } as const

  function ssoProvider(): AuthDefinition {
    return {
      id: 'sso',
      label: '사내 로그인',
      origin: 'https://portal.example.corp',
      probe: { path: '/api/me' },
      methods: [
        {
          kind: 'browser-session',
          label: '통합 인증',
          config: {
            sessionGroup: 'corp',
            loginUrl: 'https://adfs.example.corp/adfs/ls/',
            doneUrlPrefix: 'https://portal.example.corp/home',
            allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
          }
        }
      ]
    }
  }

  // 재시작 시뮬레이션 — 디스크에 세션 grant 가 남은 채로 새 store 를 세운다.
  function restarted(
    probeOk: boolean,
    extra: AuthDefinition[] = []
  ): {
    login: LoginService
    store: AuthStore
    steps: string[]
    // 함수로 돌려준다 — 숫자로 담으면 반환 시점(0)이 복사돼 증가가 보이지 않는다.
    probed: () => string[]
  } {
    const registry = new AuthRegistry([ssoProvider(), ...extra])
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence({
        sso: { ...SSO_GRANT },
        ...Object.fromEntries(extra.map((p) => [p.id, { ...SSO_GRANT }]))
      }),
      vault: createVault(fakeSecretStore()),
      clock: () => 10_000
    })
    store.restore(registry.list().map((p) => p.id))
    const steps: string[] = []
    const probed: string[] = []
    const login = new LoginService({
      registry,
      store,
      vault: createVault(fakeSecretStore()),
      clock: () => 10_000,
      request: probeApi(probeOk, probed),
      session: { login: () => Promise.reject(new Error('자동 로그인은 창을 열지 않는다')) },
      onStep: () => steps.push(login.currentStep()?.kind ?? 'none')
    })
    return { login, store, steps, probed: () => probed }
  }

  it('복원된 grant 는 확인 전까지 게이트를 열지 않는다', () => {
    const h = restarted(true)
    // 기록은 살아 있다 — 예전에는 이것만 보고 통과시켰다.
    expect(h.store.status('sso')).toBe('valid')
    expect(h.store.isVerified('sso')).toBe(false)
  })

  it('probe 가 2xx 면 창 없이 자동 로그인으로 통과한다', async () => {
    const h = restarted(true)
    await h.login.resume('sso')
    expect(h.probed()).toEqual(['sso'])
    expect(h.store.isVerified('sso')).toBe(true)
    expect(h.store.status('sso')).toBe('valid')
    // 확인 중에는 로그인 화면에 `resuming` 이 뜨고, 끝나면 걷힌다.
    expect(h.steps).toEqual(['resuming', 'none'])
    expect(h.login.currentStep()).toBeNull()
  })

  it('probe 가 실패하면 강등하고 로그인 화면에 남는다', async () => {
    const h = restarted(false)
    await h.login.resume('sso')
    expect(h.store.isVerified('sso')).toBe(false)
    expect(h.store.status('sso')).toBe('expired')
    // grant 는 남긴다 — 화면에 재인증 지점이 보여야 한다.
    expect(h.store.get('sso')).toBeDefined()
  })

  it('grant 가 없으면 probe 를 치지 않는다 — 처음부터 수동 로그인이다', async () => {
    const registry = new AuthRegistry([ssoProvider()])
    const store = new AuthStore({
      persistence: createMemoryGrantPersistence(),
      vault: createVault(fakeSecretStore())
    })
    store.restore(['sso'])
    const probed: string[] = []
    const login = new LoginService({
      registry,
      store,
      vault: createVault(fakeSecretStore()),
      request: probeApi(true, probed)
    })
    await login.resume('sso')
    expect(probed).toEqual([])
    expect(store.isVerified('sso')).toBe(false)
  })

  // PAT·API key 는 **서버가 회수·재발급하면 즉시 무효**다. vault 에 값이 남아 있는 것은
  // 근거가 아니다(만료를 아는 것은 토큰뿐이다).
  it('값형도 부팅 때 probe 로 확인한다 — 서버가 거부하면 강등된다', async () => {
    const vault = createVault(fakeSecretStore())
    const gate: AuthDefinition = {
      id: 'key-gate',
      label: '키 게이트',
      origin: 'https://gw.example.corp',
      probe: { path: '/v1/me' },
      methods: [apiKeySpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER })]
    }
    const persistence = createMemoryGrantPersistence()
    const registry = new AuthRegistry([gate])
    const store0 = new AuthStore({ persistence, vault, clock: () => 1_000 })
    store0.restore(['key-gate'])
    const accepted: string[] = []
    await new LoginService({
      registry,
      store: store0,
      vault,
      clock: () => 1_000,
      request: probeApi(true, accepted)
    }).begin('key-gate', 'api-key', { [FIELD_SECRET]: 'k' })
    expect(store0.status('key-gate')).toBe('valid')

    // 재시작 — 같은 영속·vault 위에 새 store. 그 사이 서버가 키를 회수했다.
    const store = new AuthStore({ persistence, vault, clock: () => 1_000 })
    store.restore(['key-gate'])
    expect(store.isVerified('key-gate')).toBe(false)

    const rejected: string[] = []
    await new LoginService({
      registry,
      store,
      vault,
      clock: () => 1_000,
      request: probeApi(false, rejected)
    }).resume('key-gate')
    expect(rejected).toEqual(['key-gate'])
    expect(store.isVerified('key-gate')).toBe(false)
    expect(store.status('key-gate')).toBe('expired')
  })
})
