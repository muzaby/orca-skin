import { describe, expect, it } from 'vitest'
import { BindingStore, sameTarget, targetKey, type BindingPersistence } from './bindings'
import type { AuthBindingInfo, AuthTarget } from '../../../shared/ipc'

const APP: AuthTarget = { kind: 'application', applicationId: 'orca' }
const WIKI: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }
const JIRA: AuthTarget = { kind: 'connector', connectorId: 'jira', connectionId: 'c1' }

function store(): BindingStore {
  return new BindingStore(() => 1_700_000_000_000)
}

function create(s: BindingStore, target: AuthTarget, parentBindingId?: string): string {
  return s.create({
    pluginId: 'corp',
    providerId: 'adfs',
    target,
    mechanism: 'adfs_browser_session',
    artifact: { kind: 'browser_session', handleId: 'h1', sessionGroup: 'corp-adfs' },
    ...(parentBindingId !== undefined ? { parentBindingId } : {})
  }).id
}

describe('BindingStore', () => {
  it('같은 target 의 기존 binding 을 교체한다', () => {
    const s = store()
    const first = create(s, WIKI)
    const second = create(s, WIKI)
    expect(s.get(first)).toBeUndefined()
    expect(s.get(second)).toBeDefined()
    expect(s.list()).toHaveLength(1)
  })

  it('다른 target 은 공존한다', () => {
    const s = store()
    create(s, APP)
    create(s, WIKI)
    create(s, JIRA)
    expect(s.list()).toHaveLength(3)
    expect(s.findApplicationBinding()).toBeDefined()
  })

  it('AC7 — connector-only disconnect 는 공유 앱 로그인·형제 연결을 건드리지 않는다', () => {
    const s = store()
    const app = create(s, APP)
    const wiki = create(s, WIKI, app)
    const jira = create(s, JIRA, app)

    const removed = s.remove(wiki, false)

    expect(removed).toEqual([wiki])
    expect(s.get(app)).toBeDefined()
    expect(s.get(jira)).toBeDefined()
  })

  it('AC7 — 앱 로그아웃 cascade 는 종속 binding 을 끊는다', () => {
    const s = store()
    const app = create(s, APP)
    const wiki = create(s, WIKI, app)
    const jira = create(s, JIRA, app)

    const removed = s.remove(app, true)

    expect(new Set(removed)).toEqual(new Set([app, wiki, jira]))
    expect(s.list()).toHaveLength(0)
  })

  it('cascade 가 다단계 종속을 따라간다', () => {
    const s = store()
    const app = create(s, APP)
    const wiki = create(s, WIKI, app)
    const jira = create(s, JIRA, wiki)
    expect(new Set(s.remove(app, true))).toEqual(new Set([app, wiki, jira]))
  })

  it('cascade=false 는 종속을 고아로 남기지 않고 그대로 둔다', () => {
    const s = store()
    const app = create(s, APP)
    const wiki = create(s, WIKI, app)
    s.remove(app, false)
    // 부모가 사라져도 자식 binding 자체는 유효하다 — 서비스 연결은 앱 로그인과 독립일 수 있다.
    expect(s.get(wiki)).toBeDefined()
  })

  it('status 전이를 반영한다', () => {
    const s = store()
    const id = create(s, WIKI)
    expect(s.setStatus(id, 'expired')?.status).toBe('expired')
    expect(s.get(id)?.status).toBe('expired')
  })
})

describe('target 동일성', () => {
  it('connector 는 connectorId 와 connectionId 를 모두 본다', () => {
    expect(sameTarget(WIKI, { ...WIKI })).toBe(true)
    expect(sameTarget(WIKI, { ...WIKI, connectionId: 'c2' })).toBe(false)
    expect(sameTarget(WIKI, JIRA)).toBe(false)
  })

  it('kind 가 다르면 다른 target 이다', () => {
    expect(sameTarget(APP, WIKI)).toBe(false)
  })

  it('targetKey 가 target 별로 유일하다', () => {
    const keys = new Set([targetKey(APP), targetKey(WIKI), targetKey(JIRA)])
    expect(keys.size).toBe(3)
  })
})

// 0170 — 레코드 영속. 비밀은 vault 에 있고 여기 남는 것은 handle 뿐이다.
describe('BindingStore — 영속', () => {
  function fakePersistence(seed: AuthBindingInfo[] = []): BindingPersistence & {
    saved: AuthBindingInfo[][]
  } {
    const saved: AuthBindingInfo[][] = []
    return {
      saved,
      load: () => seed,
      save: (records) => void saved.push([...records])
    }
  }

  const CONNECTOR: AuthTarget = { kind: 'connector', connectorId: 'wiki', connectionId: 'c1' }

  function record(id: string): AuthBindingInfo {
    return {
      id,
      pluginId: 'corp',
      providerId: 'pat',
      target: CONNECTOR,
      mechanism: 'personal_access_token',
      artifact: {
        kind: 'vault_credential',
        handleId: 'h1',
        credentialKind: 'personal_access_token'
      },
      status: 'valid',
      createdAt: 1
    }
  }

  it('저장된 레코드를 같은 id 로 되살린다', () => {
    // id 가 vault 네임스페이스의 열쇠라, 같은 id 로 살아나야 비밀을 다시 찾는다.
    const persistence = fakePersistence([record('bind_kept')])
    const store = new BindingStore(() => 1, persistence)
    store.adopt(store.loadPersisted())
    expect(store.list().map((b) => b.id)).toEqual(['bind_kept'])
    expect(store.get('bind_kept')?.target).toEqual(CONNECTOR)
  })

  it('레코드 변경마다 저장소에 반영한다', () => {
    const persistence = fakePersistence()
    const store = new BindingStore(() => 1, persistence)
    const created = store.create({
      pluginId: 'corp',
      providerId: 'pat',
      target: CONNECTOR,
      mechanism: 'personal_access_token',
      artifact: {
        kind: 'vault_credential',
        handleId: 'h1',
        credentialKind: 'personal_access_token'
      }
    })
    store.setStatus(created.id, 'expired')
    store.patch(created.id, { status: 'valid' })
    store.remove(created.id, false)

    // create · setStatus · patch · remove 네 경로가 모두 저장을 부른다.
    expect(persistence.saved).toHaveLength(4)
    expect(persistence.saved[0].map((b) => b.id)).toEqual([created.id])
    expect(persistence.saved[1][0].status).toBe('expired')
    expect(persistence.saved[2][0].status).toBe('valid')
    // 마지막 저장은 빈 목록이다 — 지운 레코드가 다음 부팅에 되살아나면 안 된다.
    expect(persistence.saved[3]).toEqual([])
  })

  it('영속 포트가 없으면 메모리 전용으로 동작한다', () => {
    const store = new BindingStore(() => 1)
    expect(store.loadPersisted()).toEqual([])
    const created = store.create({
      pluginId: 'corp',
      providerId: 'pat',
      target: CONNECTOR,
      mechanism: 'personal_access_token',
      artifact: {
        kind: 'vault_credential',
        handleId: 'h1',
        credentialKind: 'personal_access_token'
      }
    })
    // 던지지 않고 종전대로 동작한다.
    expect(store.get(created.id)).toBeDefined()
  })

  it('adopt 는 폐기분을 저장소에서도 지운다', () => {
    const persistence = fakePersistence([record('a'), record('b')])
    const store = new BindingStore(() => 1, persistence)
    store.adopt(store.loadPersisted().filter((b) => b.id === 'a'))
    expect(store.list().map((b) => b.id)).toEqual(['a'])
    expect(persistence.saved.at(-1)?.map((b) => b.id)).toEqual(['a'])
  })

  it('새 binding id 가 복원된 id 와 겹치지 않는다', () => {
    // 겹치면 새 binding 이 남의 vault 네임스페이스를 물려받는다.
    const store = new BindingStore(() => 1, fakePersistence([record('bind_1_x')]))
    store.adopt(store.loadPersisted())
    const created = store.create({
      pluginId: 'corp',
      providerId: 'pat',
      target: { kind: 'connector', connectorId: 'other', connectionId: 'c1' },
      mechanism: 'personal_access_token',
      artifact: {
        kind: 'vault_credential',
        handleId: 'h2',
        credentialKind: 'personal_access_token'
      }
    })
    expect(created.id).not.toBe('bind_1_x')
    expect(store.get('bind_1_x')).toBeDefined()
  })
})
