import { beforeEach, describe, expect, it } from 'vitest'
import type { Provider } from '../../../contracts/provider'
import { createVault, type Vault } from '../../../infra/vault'
import type { SecretStorePort } from '../../../infra/config/secret-facade'
import { LoginService } from './login'
import { ProviderRegistry } from './registry'
import { createMemoryGrantPersistence, ProviderStore, type GrantPersistencePort } from './store'
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

function gateway(): Provider {
  return {
    id: 'gw',
    label: '게이트웨이',
    kind: 'llm',
    origin: 'https://gw.example.corp',
    auth: [
      apiKeySpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER }),
      passwordSpec({ label: 'ID/비밀번호', present: BEARER })
    ]
  }
}

interface Harness {
  login: LoginService
  store: ProviderStore
  vault: Vault
  persistence: GrantPersistencePort
  secrets: ReturnType<typeof fakeSecretStore>
}

function harness(providers: Provider[] = [gateway()]): Harness {
  const secrets = fakeSecretStore()
  const vault = createVault(secrets)
  const persistence = createMemoryGrantPersistence()
  const registry = new ProviderRegistry(providers)
  const store = new ProviderStore({ persistence, vault, clock: () => 1_000 })
  store.restore(registry.list().map((p) => p.id))
  const login = new LoginService({ registry, store, vault, clock: () => 1_000 })
  return { login, store, vault, persistence, secrets }
}

describe('LoginService — 코어 3종 (AC2)', () => {
  it('코어 3종이 vault 왕복 후 valid 로 복원된다', async () => {
    const h = harness([
      {
        id: 'wiki',
        label: 'Wiki',
        kind: 'service',
        origin: 'https://wiki.example.corp',
        auth: [
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
      expect(h.vault.get(`wiki:${authKind}`)).toBe(expected)
    }

    // 재시작 흉내 — 같은 영속·vault 위에 store 를 새로 만들면 grant 가 그대로 복원된다.
    const restored = new ProviderStore({ persistence: h.persistence, vault: h.vault })
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

describe('LoginService — 복수 AuthSpec (AC5)', () => {
  it('복수 AuthSpec 중 고른 방식으로 인증한다', async () => {
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
    expect(h.vault.get('gw:password')).toBe('kim:pw')
    expect(h.vault.get('gw:api-key')).toBeNull()
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

describe('LoginService — 재인증 (AC6)', () => {
  let h: Harness
  beforeEach(async () => {
    h = harness()
    await h.login.begin('gw', 'api-key', { [FIELD_SECRET]: 'old-key' })
  })

  it('재인증 실패는 기존 grant 를 보존한다', async () => {
    // 시작만 하고 값을 안 낸다 — 기존 grant 는 살아 있어야 한다.
    expect(await h.login.reauth('gw', 'api-key')).toMatchObject({ kind: 'input-required' })
    expect(h.store.status('gw')).toBe('valid')
    expect(h.vault.get('gw:api-key')).toBe('old-key')

    // 빈 값으로 거부당해도 마찬가지다.
    await h.login.continue('gw', { [FIELD_SECRET]: '   ' })
    expect(h.store.status('gw')).toBe('valid')
    expect(h.vault.get('gw:api-key')).toBe('old-key')
  })

  it('재인증 성공에서만 교체된다', async () => {
    await h.login.reauth('gw', 'api-key')
    expect(await h.login.continue('gw', { [FIELD_SECRET]: 'new-key' })).toEqual({
      kind: 'done',
      providerId: 'gw'
    })
    expect(h.vault.get('gw:api-key')).toBe('new-key')
  })

  it('해제는 grant 와 vault 잔여물을 함께 지운다', () => {
    h.login.revoke('gw')
    expect(h.store.status('gw')).toBe('none')
    expect(h.vault.get('gw:api-key')).toBeNull()
    // metadata·index 까지 정리돼 재인증이 깨끗한 상태에서 시작한다.
    expect([...h.secrets.raw.keys()].filter((k) => k.includes('gw:api-key'))).toEqual([])
  })
})

describe('ProviderStore — 상태 판정', () => {
  it('만료된 토큰은 expired 로 강등되고 값이 나가지 않는다', () => {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    const store = new ProviderStore({
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
    const store = new ProviderStore({ persistence: createMemoryGrantPersistence(), vault })
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
    const store = new ProviderStore({
      persistence,
      vault: createVault(fakeSecretStore()),
      onOrphan: (id) => orphans.push(id)
    })
    store.restore(['gw'])
    expect(orphans).toEqual(['ghost'])
    expect(store.get('ghost')).toBeUndefined()
    // 영속 원본은 건드리지 않는다 — 선언이 돌아오면 재로그인 없이 살아난다.
    expect(Object.keys(persistence.load())).toEqual(['ghost'])
  })
})

// ── 회귀: 복원된 grant 는 게이트 통과 근거가 아니다 ──────────────────────────
//
// 사용자 보고 — "구현한 sso provider 로 로그인 성공 시, 해당 provider 의 id 는 영구적으로
// bypass 와 같은 현상". `kind:'session'` grant 는 vault 도 만료도 없어 기록만으로 계속
// `status:'valid'` 라, 게이트가 status 만 보면 재시작 후에도 로그인 화면이 아예 뜨지 않는다.
// 통과 근거는 **이번 실행에서 실제로 로그인했는가**(`isVerified`)로 옮겼다.
describe('ProviderStore — 인증 확인은 실행 수명이다', () => {
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
    const store = new ProviderStore({ persistence, vault: createVault(fakeSecretStore()) })
    store.restore(['sso'])
    // 기록은 살아 있다 — 이것만 보면 예전처럼 게이트가 열렸다.
    expect(store.status('sso')).toBe('valid')
    // 통과 근거는 이쪽이고, 재시작을 넘어오지 않는다.
    expect(store.isVerified('sso')).toBe(false)
  })

  it('해제·401 강등은 확인을 함께 푼다', () => {
    const persistence = createMemoryGrantPersistence()
    const store = new ProviderStore({ persistence, vault: createVault(fakeSecretStore()) })
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
// 재시작하면 게이트는 닫혀 있고, `resume()` 이 복원된 세션 쿠키가 아직 유효한지 probe 로 한 번
// 확인한다. 2xx(+origin 복귀)면 사용자가 아무것도 하지 않고 통과하고, 아니면 로그인 화면에
// 남는다. 값형은 왕복 없이 로컬 근거(vault+만료)로 판정한다.
describe('LoginService — 자동 로그인(resume)', () => {
  const SSO_GRANT = {
    kind: 'session',
    sessionGroup: 'corp',
    authKind: 'browser-session',
    createdAt: 0
  } as const

  function ssoProvider(): Provider {
    return {
      id: 'sso',
      label: '사내 로그인',
      kind: 'gate',
      origin: 'https://portal.example.corp',
      auth: [
        {
          kind: 'browser-session',
          label: '통합 인증',
          config: {
            sessionGroup: 'corp',
            loginUrl: 'https://adfs.example.corp/adfs/ls/',
            doneUrlPrefix: 'https://portal.example.corp/home',
            authenticationProbeUrl: 'https://portal.example.corp/api/me',
            allowedOrigins: ['https://adfs.example.corp', 'https://portal.example.corp']
          }
        }
      ]
    }
  }

  // 재시작 시뮬레이션 — 디스크에 세션 grant 가 남은 채로 새 store 를 세운다.
  function restarted(probeOk: boolean): {
    login: LoginService
    store: ProviderStore
    steps: string[]
    // 함수로 돌려준다 — 숫자로 담으면 반환 시점(0)이 복사돼 증가가 보이지 않는다.
    calls: () => number
  } {
    const registry = new ProviderRegistry([ssoProvider()])
    const store = new ProviderStore({
      persistence: createMemoryGrantPersistence({ sso: { ...SSO_GRANT } }),
      vault: createVault(fakeSecretStore()),
      clock: () => 10_000
    })
    store.restore(registry.list().map((p) => p.id))
    const steps: string[] = []
    let calls = 0
    const login = new LoginService({
      registry,
      store,
      vault: createVault(fakeSecretStore()),
      clock: () => 10_000,
      session: {
        login: () => Promise.reject(new Error('자동 로그인은 창을 열지 않는다')),
        verify: () => {
          calls += 1
          return Promise.resolve(probeOk)
        }
      },
      onChange: () => steps.push(login.currentStep()?.kind ?? 'none')
    })
    return { login, store, steps, calls: () => calls }
  }

  it('복원된 세션 grant 는 확인 전까지 게이트를 열지 않는다', () => {
    const h = restarted(true)
    // 기록은 살아 있다 — 예전에는 이것만 보고 통과시켰다.
    expect(h.store.status('sso')).toBe('valid')
    expect(h.store.isVerified('sso')).toBe(false)
  })

  it('probe 가 2xx 면 창 없이 자동 로그인으로 통과한다', async () => {
    const h = restarted(true)
    await h.login.resume()
    expect(h.calls()).toBe(1)
    expect(h.store.isVerified('sso')).toBe(true)
    expect(h.store.status('sso')).toBe('valid')
    // 확인 중에는 로그인 화면에 `resuming` 이 뜨고, 끝나면 걷힌다.
    expect(h.steps).toEqual(['resuming', 'none'])
    expect(h.login.currentStep()).toBeNull()
  })

  it('probe 가 실패하면 강등하고 로그인 화면에 남는다', async () => {
    const h = restarted(false)
    await h.login.resume()
    expect(h.store.isVerified('sso')).toBe(false)
    expect(h.store.status('sso')).toBe('expired')
    // grant 는 남긴다 — 화면에 재인증 지점이 보여야 한다.
    expect(h.store.get('sso')).toBeDefined()
  })

  it('세션 실행기가 없으면 통과시키지 않는다 (fail-closed)', async () => {
    const registry = new ProviderRegistry([ssoProvider()])
    const store = new ProviderStore({
      persistence: createMemoryGrantPersistence({ sso: { ...SSO_GRANT } }),
      vault: createVault(fakeSecretStore())
    })
    store.restore(['sso'])
    const login = new LoginService({ registry, store, vault: createVault(fakeSecretStore()) })
    await login.resume()
    expect(store.isVerified('sso')).toBe(false)
  })

  it('grant 가 없으면 probe 를 치지 않는다 — 처음부터 수동 로그인이다', async () => {
    const registry = new ProviderRegistry([ssoProvider()])
    const store = new ProviderStore({
      persistence: createMemoryGrantPersistence(),
      vault: createVault(fakeSecretStore())
    })
    store.restore(['sso'])
    let calls = 0
    const login = new LoginService({
      registry,
      store,
      vault: createVault(fakeSecretStore()),
      session: {
        login: () => Promise.reject(new Error('unused')),
        verify: () => {
          calls += 1
          return Promise.resolve(true)
        }
      }
    })
    await login.resume()
    expect(calls).toBe(0)
    expect(store.isVerified('sso')).toBe(false)
  })

  // 값형 게이트는 값이 vault 에 있는 것 자체가 근거다 — probe 를 물리면 재시작마다 키를
  // 다시 입력하게 된다.
  it('값형 게이트는 왕복 없이 로컬 근거로 통과한다', async () => {
    const secrets = fakeSecretStore()
    const vault = createVault(secrets)
    const gate: Provider = {
      id: 'key-gate',
      label: '키 게이트',
      kind: 'gate',
      origin: 'https://gw.example.corp',
      auth: [apiKeySpec({ label: 'API 키', fieldLabel: 'API 키', present: BEARER })]
    }
    const persistence = createMemoryGrantPersistence()
    const registry = new ProviderRegistry([gate])
    const first = new LoginService({
      registry,
      store: (() => {
        const s = new ProviderStore({ persistence, vault, clock: () => 1_000 })
        s.restore(['key-gate'])
        return s
      })(),
      vault,
      clock: () => 1_000
    })
    await first.begin('key-gate', 'api-key', { [FIELD_SECRET]: 'k' })

    // 재시작 — 같은 영속·vault 위에 새 store.
    const store = new ProviderStore({ persistence, vault, clock: () => 1_000 })
    store.restore(['key-gate'])
    expect(store.isVerified('key-gate')).toBe(false)

    const login = new LoginService({ registry, store, vault, clock: () => 1_000 })
    await login.resume()
    expect(store.isVerified('key-gate')).toBe(true)
  })
})
