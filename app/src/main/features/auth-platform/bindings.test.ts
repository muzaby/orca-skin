import { describe, expect, it } from 'vitest'
import { BindingStore, sameTarget, targetKey } from './bindings'
import type { AuthTarget } from '../../../shared/ipc'

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
