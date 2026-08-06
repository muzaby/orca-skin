// binding 복원 (0170) — **비밀이 아직 있는지 vault 에 물어보고 나서** 살리는지 확인한다.
// 레코드만 보고 살리면 UI 는 "연결됨" 이라 표시해 놓고 첫 요청에서 깨진다.

import { describe, expect, it } from 'vitest'
import { AuthBroker, BINDING_SECRET_NAME, type BrokerDeps } from './broker'
import { AuthRegistry } from './registry'
import { authBindingPrefix, createCredentialVault } from '../../infra/auth/credential-vault'
import type { SecretStorePort } from '../../infra/config/secret-facade'
import type { AuthBindingInfo, AuthPlatformState } from '../../../shared/ipc'

function fakeStore(): SecretStorePort & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    get: (n) => raw.get(n),
    set: (n, v) => void raw.set(n, v),
    delete: (n) => void raw.delete(n)
  }
}

function connectorRecord(id: string, connectorId = 'wiki'): AuthBindingInfo {
  return {
    id,
    providerId: 'pat',
    target: { kind: 'connector', connectorId, connectionId: 'c1' },
    mechanism: 'personal_access_token',
    artifact: { kind: 'vault_credential', handleId: 'h1', credentialKind: 'personal_access_token' },
    status: 'valid',
    createdAt: 1
  }
}

function setup(seed: AuthBindingInfo[]): {
  broker: AuthBroker
  store: ReturnType<typeof fakeStore>
  saved: AuthBindingInfo[][]
  states: AuthPlatformState[]
} {
  const store = fakeStore()
  const saved: AuthBindingInfo[][] = []
  const states: AuthPlatformState[] = []
  const deps: BrokerDeps = {
    registry: new AuthRegistry(),
    vaultFor: (prefix) => createCredentialVault(store, prefix),
    fetchImpl: stubFetch,
    browserSessions: {
      acquire: async () => 'h',
      openLoginWindow: async () => ({ finalUrl: '' }),
      probe: async () => ({ ok: true, status: 200, finalUrl: '' }),
      send: async () => ({ status: 200, headers: {}, body: '' }),
      clear: async () => undefined
    },
    broadcast: (s) => states.push(s),
    bindingPersistence: {
      load: () => seed,
      save: (records) => void saved.push([...records])
    }
  }
  return { broker: new AuthBroker(deps), store, saved, states }
}

// vault 에 값을 넣어 "비밀이 남아 있는" 상태를 만든다.
function seedSecret(store: ReturnType<typeof fakeStore>, bindingId: string): void {
  createCredentialVault(store, authBindingPrefix(bindingId)).set(BINDING_SECRET_NAME, 'pat-value', {
    kind: 'personal_access_token',
    createdAt: 1
  })
}

// 0173 — `fetchImpl` 은 필수다(전역 fetch 로 되돌아가지 않게). 이 스위트는 원격에
// 나가지 않으므로 빈 응답 스텁을 준다; 실제 호출을 보는 케이스는 자기 것을 주입한다.
const stubFetch: typeof fetch = async () => new Response('{}', { status: 200 })

describe('AuthBroker.restore', () => {
  it('비밀이 남아 있는 binding 을 valid 로 복원한다', () => {
    const { broker, store } = setup([connectorRecord('b1')])
    seedSecret(store, 'b1')

    const restored = broker.restore()
    expect(restored).toEqual([{ bindingId: 'b1', connectorId: 'wiki', connectionId: 'c1' }])
    expect(broker.listBindings().map((b) => ({ id: b.id, status: b.status }))).toEqual([
      { id: 'b1', status: 'valid' }
    ])
  })

  it('비밀이 없는 레코드는 복원하지 않고 지운다', () => {
    // 값이 없는 binding 을 남기면 UI 가 "연결됨" 이라 거짓말한다.
    const { broker, saved } = setup([connectorRecord('b1')])
    expect(broker.restore()).toEqual([])
    expect(broker.listBindings()).toEqual([])
    // 저장소에서도 사라진다 — 다음 부팅에 또 되살아나면 안 된다.
    expect(saved.at(-1)).toEqual([])
  })

  it('복호화 실패는 버리지 않고 unknown 으로 둔다', () => {
    // 키체인 잠김·다른 머신 — 값이 돌아올 수 있으므로 레코드를 지우면 안 된다.
    const { broker, store } = setup([connectorRecord('b1')])
    seedSecret(store, 'b1')
    // index 는 남기고 값만 지워 '복호화 실패' 상태를 만든다.
    store.raw.delete(`${authBindingPrefix('b1')}${BINDING_SECRET_NAME}`)

    const restored = broker.restore()
    expect(restored).toEqual([])
    expect(broker.listBindings().map((b) => b.status)).toEqual(['unknown'])
  })

  it('browser_session binding 은 복원하지 않는다', () => {
    // cookie jar 는 binding 밖(Electron session partition)에 있어 handle 만으로는 못 살린다.
    const record: AuthBindingInfo = {
      ...connectorRecord('b1'),
      artifact: { kind: 'browser_session', handleId: 'h1', sessionGroup: 'corp' }
    }
    const { broker, store } = setup([record])
    seedSecret(store, 'b1')
    expect(broker.restore()).toEqual([])
    expect(broker.listBindings()).toEqual([])
  })

  it('application binding 은 복원하지 않는다 — 게이트를 건너뛰지 않는다', () => {
    const record: AuthBindingInfo = {
      ...connectorRecord('b1'),
      target: { kind: 'application', applicationId: 'orca' }
    }
    const { broker, store } = setup([record])
    seedSecret(store, 'b1')
    expect(broker.restore()).toEqual([])
    expect(broker.status().authenticated).toBe(false)
  })

  it('여러 connector 를 함께 복원한다', () => {
    const { broker, store } = setup([connectorRecord('b1', 'wiki'), connectorRecord('b2', 'jira')])
    seedSecret(store, 'b1')
    seedSecret(store, 'b2')
    expect(broker.restore().map((r) => r.connectorId)).toEqual(['wiki', 'jira'])
  })

  it('logout 한 binding 은 다음 부팅에 복원되지 않는다', async () => {
    const { broker, store, saved } = setup([connectorRecord('b1')])
    seedSecret(store, 'b1')
    broker.restore()

    await broker.logout('b1', false)
    // 마지막 저장 상태가 다음 부팅의 입력이다.
    expect(saved.at(-1)).toEqual([])
  })

  // 0172 접점 — 로그인 체인은 application binding 을 **여러 개** 쓴다. 0170 이 "application 은
  // 복원하지 않는다"(RootGate 자동 통과 금지)로 못 박았으므로, 멤버가 늘어도 그 필터가 유효해야
  // 한다. 안 그러면 재시작만으로 앱 로그인 게이트가 통과된다.
  it('application 체인 레코드는 복원하지 않고 저장소에서도 지운다', () => {
    const root: AuthBindingInfo = {
      ...connectorRecord('app_root'),
      target: { kind: 'application', applicationId: 'orca' }
    }
    const member: AuthBindingInfo = {
      ...connectorRecord('app_member'),
      target: { kind: 'application', applicationId: 'orca' },
      parentBindingId: 'app_root'
    }
    const { broker, store, saved } = setup([root, member])
    seedSecret(store, 'app_root')
    seedSecret(store, 'app_member')

    expect(broker.restore()).toEqual([])
    expect(broker.status().authenticated).toBe(false)
    expect(broker.listBindings()).toEqual([])
    // 다음 부팅의 입력에서도 사라진다 — 남기면 매 부팅마다 되살아난다.
    expect(saved.at(-1)).toEqual([])
  })

  it('저장된 레코드가 없으면 아무 상태도 발행하지 않는다', () => {
    const { broker, states } = setup([])
    expect(broker.restore()).toEqual([])
    expect(states).toEqual([])
  })
})
