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
