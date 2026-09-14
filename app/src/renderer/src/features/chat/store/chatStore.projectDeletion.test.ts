import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadedSession } from '../../../../../shared/ipc'
import { chatActions, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'

beforeEach(() =>
  installChatStoreHarness({
    inflight: true,
    cwd: 'C:/work',
    messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: '보존할 본문' }] }]
  })
)

describe('프로젝트 삭제는 대화 캐시의 소속만 해제한다', () => {
  it('활성·비활성·초안의 소속을 해제하고 본문·live·cwd·선택을 보존한다', () => {
    const original = useChatStore.getState().sessions.s
    const owned = { ...original, session: { ...original.session, projectId: 'deleted-cache' } }
    const draft = {
      ...original,
      session: { ...original.session, sessionId: null, pendingProjectId: 'deleted-cache' }
    }
    useChatStore.setState({ sessions: { s: owned, other: original, draft }, activeKey: 's' })
    chatActions.detachProject('deleted-cache')
    const state = useChatStore.getState()
    expect(state.activeKey).toBe('s')
    expect(Object.keys(state.sessions)).toEqual(['s', 'other', 'draft'])
    expect(state.sessions.s.session).toEqual({ ...owned.session, projectId: null })
    expect(state.sessions.s.session.messages).toBe(owned.session.messages)
    expect(state.sessions.s.live).toBe(owned.live)
    expect(state.sessions.other).toBe(original)
    expect(state.sessions.draft.session.pendingProjectId).toBeNull()
  })

  it('늦은 session.updated에서 삭제한 소속만 무시하고 나머지 이벤트 메타는 반영한다', () => {
    chatActions.detachProject('deleted-event')
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 's',
      patch: { projectId: 'deleted-event', permissionMode: 'plan', cwd: 'C:/work' }
    })
    expect(useChatStore.getState().sessions.s.session).toMatchObject({
      projectId: null,
      sessionId: 's',
      permissionMode: 'plan',
      inflight: true,
      cwd: 'C:/work'
    })
    ingestChatEvent({
      type: 'session.updated',
      sessionId: 's',
      patch: { projectId: 'new-project-uuid' }
    })
    expect(useChatStore.getState().sessions.s.session.projectId).toBe('new-project-uuid')
  })

  it('삭제 전에 시작한 load가 나중에 도착해도 본문은 로드하고 프로젝트는 복원하지 않는다', async () => {
    let resolve!: (session: LoadedSession) => void
    const loading = new Promise<LoadedSession>((done) => {
      resolve = done
    })
    Object.assign(window.orca, { session: { load: vi.fn(() => loading) } })
    const operation = chatActions.loadSession('late-load')
    chatActions.detachProject('deleted-load')
    resolve({
      id: 'late-load',
      projectId: 'deleted-load',
      agentKind: 'code',
      title: '보존한 대화',
      cwd: 'C:/saved',
      messages: [],
      backend: 'claude'
    })
    await operation
    expect(useChatStore.getState().sessions['late-load'].session).toMatchObject({
      sessionId: 'late-load',
      title: '보존한 대화',
      projectId: null,
      cwd: 'C:/saved'
    })
  })
})
