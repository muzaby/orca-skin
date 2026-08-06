import { describe, expect, it } from 'vitest'
import { authBindingPrefix, authMethodPrefix, createCredentialVault } from './credential-vault'
import type { SecretStorePort } from '../config/secret-facade'
import type { CredentialMeta } from '../../../shared/ipc'

// SecretStore 의 인메모리 대역. `undecryptable` 을 흉내내기 위해 get 만 실패시킬 수 있다.
function fakeStore(): SecretStorePort & { raw: Map<string, string>; blind: Set<string> } {
  const raw = new Map<string, string>()
  const blind = new Set<string>()
  return {
    raw,
    blind,
    get: (name) => (blind.has(name) ? undefined : raw.get(name)),
    set: (name, plain) => {
      raw.set(name, plain)
    },
    delete: (name) => {
      raw.delete(name)
    }
  }
}

const META: CredentialMeta = { kind: 'personal_access_token', service: 'wiki', createdAt: 1 }

describe('createCredentialVault', () => {
  it('네임스페이스를 강제해 다른 provider 의 비밀에 닿지 않는다', () => {
    const store = fakeStore()
    const a = createCredentialVault(store, authMethodPrefix('provider-a'))
    const b = createCredentialVault(store, authMethodPrefix('provider-b'))

    a.set('secret', 'value-a', META)

    expect(a.get('secret')).toBe('value-a')
    // 같은 이름을 써도 b 에게는 보이지 않는다.
    expect(b.get('secret')).toBeNull()
  })

  it('binding 네임스페이스가 provider 네임스페이스와 분리된다', () => {
    const store = fakeStore()
    const provider = createCredentialVault(store, authMethodPrefix('p'))
    const binding = createCredentialVault(store, authBindingPrefix('bind_1'))
    provider.set('secret', 'from-provider', META)
    binding.set('secret', 'from-binding', META)
    expect(provider.get('secret')).toBe('from-provider')
    expect(binding.get('secret')).toBe('from-binding')
  })

  it('kind metadata 를 보존한다 (api_key / PAT 를 뭉개지 않는다)', () => {
    const store = fakeStore()
    const vault = createCredentialVault(store, 'ns:')
    vault.set('k', 'v', { kind: 'api_key', createdAt: 1 })
    expect(vault.describe('k')?.kind).toBe('api_key')
    vault.set('p', 'v', { kind: 'personal_access_token', scopes: ['read'], createdAt: 2 })
    expect(vault.describe('p')?.kind).toBe('personal_access_token')
    expect(vault.describe('p')?.scopes).toEqual(['read'])
  })

  it('metadata 에 값 자체를 담지 않는다', () => {
    const store = fakeStore()
    const vault = createCredentialVault(store, 'ns:')
    vault.set('k', 'super-secret-value', META)
    expect(JSON.stringify(vault.describe('k'))).not.toMatch(/super-secret-value/)
  })

  it('부재와 복호화 실패를 구분한다 (요구명세 §미비 보완 3)', () => {
    const store = fakeStore()
    const vault = createCredentialVault(store, 'ns:')

    expect(vault.read('missing')).toEqual({ state: 'absent' })

    vault.set('k', 'v', META)
    expect(vault.read('k')).toEqual({ state: 'found', value: 'v' })

    // 키체인 잠김 등으로 복호화만 실패하는 상황 — index 에는 이름이 남아 있다.
    store.blind.add('ns:k')
    expect(vault.read('k')).toEqual({ state: 'undecryptable' })
  })

  it('delete 는 값·metadata·index 를 함께 지운다', () => {
    const store = fakeStore()
    const vault = createCredentialVault(store, 'ns:')
    vault.set('k', 'v', META)
    vault.delete('k')
    expect(vault.get('k')).toBeNull()
    expect(vault.describe('k')).toBeNull()
    // index 에서도 빠져 부재로 판정된다(복호화 실패로 오인하지 않는다).
    expect(vault.read('k')).toEqual({ state: 'absent' })
  })

  it('clearAll 은 네임스페이스 잔여물을 남기지 않는다 (logout cleanup)', () => {
    const store = fakeStore()
    const vault = createCredentialVault(store, 'ns:')
    const other = createCredentialVault(store, 'keep:')
    vault.set('a', '1', META)
    vault.set('b', '2', META)
    other.set('a', 'keep-me', META)

    vault.clearAll()

    expect([...store.raw.keys()].filter((k) => k.startsWith('ns:'))).toEqual([])
    // 다른 네임스페이스는 건드리지 않는다.
    expect(other.get('a')).toBe('keep-me')
  })

  it('손상된 metadata JSON 을 null 로 강등한다', () => {
    const store = fakeStore()
    const vault = createCredentialVault(store, 'ns:')
    vault.set('k', 'v', META)
    store.raw.set('ns:k#meta', '{ not json')
    expect(vault.describe('k')).toBeNull()
  })
})
