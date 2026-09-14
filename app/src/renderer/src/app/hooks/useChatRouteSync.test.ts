import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, SessionListItem } from '../../../../shared/ipc'
import type { ChatState } from '../../features/chat/reducer/chatReducer'
import {
  chatActions,
  getActiveChatSession,
  ingestChatEvent,
  useChatStore
} from '../../features/chat/store/chatStore'
import { installChatStoreHarness } from '../../features/chat/store/chatStore.testHarness'
import { projectsActions, useProjectsStore } from '../../features/projects/store/projectsStore'
import { sessionsActions, useSessionsStore } from '../../features/sessions/store/sessionsStore'
import { splitNavSections } from '../../features/sessions/lib/navSections'
import { chatApi, projectApi, sessionApi } from '../../shared/api/ipc'
import { useChatRouteSync } from './useChatRouteSync'
import { useChatSessionsSync } from './useChatSessionsSync'

// 실제 hook/store를 호출하되 refs·deps·effect 순서만 모델링한다. DOM/라우터의 프레임
// 스케줄링은 이 시험 범위가 아니며, 잘못된 reset과 navigate라는 앱의 결정을 검증한다.
const h = vi.hoisted(() => ({
  pathname: '/projects/a',
  navigate: vi.fn(),
  refs: [] as { current: unknown }[],
  dependencies: [] as (readonly unknown[])[],
  effects: [] as (() => unknown)[],
  refIndex: 0,
  effectIndex: 0,
  includeSync: false
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: (initialValue: unknown) => {
    const index = h.refIndex++
    return h.refs[index] ?? (h.refs[index] = { current: initialValue })
  },
  useEffect: (setup: () => unknown, dependencies: readonly unknown[]) => {
    const index = h.effectIndex++
    const previous = h.dependencies[index]
    if (!previous || dependencies.some((value, i) => !Object.is(value, previous[i]))) {
      h.effects.push(setup)
    }
    h.dependencies[index] = dependencies
  }
}))
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useLocation: () => ({ pathname: h.pathname }),
  useNavigate: () => h.navigate
}))
vi.mock('../../features/chat', async () => {
  const store = await import('../../features/chat/store/chatStore')
  return {
    chatActions: store.chatActions,
    getActiveChatSession: store.getActiveChatSession,
    useChatSession: (select: (state: ChatState) => unknown) => select(store.getActiveChatSession()),
    useChatBusy: () => store.getActiveChatSession().inflight,
    useChatRecentsEpoch: () => store.useChatStore.getState().recentsEpoch
  }
})
vi.mock('../../features/projects', async () => {
  const store = await import('../../features/projects/store/projectsStore')
  return {
    projectsActions: store.projectsActions,
    useProjectsState: (
      select: (state: ReturnType<typeof store.useProjectsStore.getState>) => unknown
    ) => select(store.useProjectsStore.getState())
  }
})
vi.mock('../../features/sessions', async () => {
  const store = await import('../../features/sessions/store/sessionsStore')
  const nav = await import('../../features/sessions/store/projectNavStore')
  return {
    sessionsActions: store.sessionsActions,
    projectNavActions: nav.projectNavActions,
    useSessionsState: (
      select: (state: ReturnType<typeof store.useSessionsStore.getState>) => unknown
    ) => select(store.useSessionsStore.getState())
  }
})

const project = (id: string): Project => ({
  id,
  name: id,
  cwd: `C:/${id}`,
  instructions: '',
  createdAt: 1,
  updatedAt: 1,
  pinnedAt: null
})
const session = (id: string): SessionListItem => ({
  id,
  title: id,
  agentKind: 'work',
  backend: 'claude',
  projectId: 'a',
  cwd: 'C:/a',
  preview: null,
  updatedAt: id === 'new' ? 2 : 1,
  pinnedAt: null
})

function render(): void {
  h.refIndex = 0
  h.effectIndex = 0
  RouteProbe()
  if (h.includeSync) SessionsProbe()
  const effects = h.effects.splice(0)
  for (const setup of effects) setup()
}

function RouteProbe(): void {
  useChatRouteSync()
}

function SessionsProbe(): void {
  useChatSessionsSync()
}

function enterProject(): void {
  render()
  render()
  h.navigate.mockClear()
}

function sendAndConfirm(): void {
  expect(chatActions.send('프로젝트 첫 메시지')).toBe(true)
  ingestChatEvent({ type: 'session.updated', sessionId: 'new', patch: { projectId: 'a' } })
}

beforeEach(() => {
  installChatStoreHarness({ inflight: false })
  h.pathname = '/projects/a'
  h.refs = []
  h.dependencies = []
  h.effects = []
  h.includeSync = false
  h.navigate.mockReset()
  useProjectsStore.setState({ list: [project('a'), project('b')], loading: false })
  useSessionsStore.setState({ byId: {}, recentIds: [], projectSessionIds: {}, loading: false })
  vi.spyOn(chatApi, 'onEvent').mockReturnValue(() => {})
  vi.spyOn(projectApi, 'list').mockImplementation(async () => [project('a'), project('b')])
  vi.spyOn(projectApi, 'listSessions').mockResolvedValue([session('old')])
  vi.spyOn(sessionApi, 'list').mockResolvedValue([session('new'), session('old')])
})
afterEach(() => vi.restoreAllMocks())

describe('useChatRouteSync — 프로젝트 진입과 대화 승격', () => {
  it('동일 프로젝트 카탈로그 교체와 승격이 겹쳐도 본문을 보존하고 실제 ID로 한 번 이동한다', async () => {
    enterProject()
    sendAndConfirm()
    const before = getActiveChatSession()
    await projectsActions.refresh()
    render()
    expect(getActiveChatSession()).toBe(before)
    expect(getActiveChatSession().messages).toHaveLength(1)
    expect(h.navigate.mock.calls).toEqual([['/chat/new', { replace: true }]])
    await projectsActions.refresh()
    render()
    expect(getActiveChatSession()).toBe(before)
    expect(h.navigate).toHaveBeenCalledTimes(1)
  })

  it('동일 경로의 지각 cwd는 한 번만 채우고 직접 선택한 폴더와 미전송 초안을 보존한다', () => {
    useProjectsStore.setState({ list: [], loading: true })
    enterProject()
    useProjectsStore.setState({ list: [project('a')], loading: false })
    render()
    expect(getActiveChatSession().cwd).toBe('C:/a')
    chatActions.setPendingCwd('C:/Chosen')
    useProjectsStore.setState({ list: [{ ...project('a'), cwd: 'C:/Changed' }] })
    render()
    expect(getActiveChatSession()).toMatchObject({
      sessionId: null,
      pendingProjectId: 'a',
      cwd: 'C:/Chosen'
    })
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it.each(['/projects/b', '/new'])(
    'A 승격과 %s 진입이 겹치면 이전 A 대신 새 landing을 유지한다',
    (pathname) => {
      enterProject()
      sendAndConfirm()
      h.pathname = pathname
      render()
      render()
      expect(getActiveChatSession()).toMatchObject({
        sessionId: null,
        pendingProjectId: pathname === '/new' ? null : 'b',
        messages: []
      })
      expect(useChatStore.getState().sessions.new.session.messages).toHaveLength(1)
      expect(h.navigate).not.toHaveBeenCalled()
    }
  )

  it.each(['/projects', '/chat/s'])(
    '확정 전에 %s로 이탈하면 늦은 A 확정이 현재 화면을 빼앗지 않는다',
    (pathname) => {
      enterProject()
      expect(chatActions.send('프로젝트 첫 메시지')).toBe(true)
      h.pathname = pathname
      render()
      render()
      ingestChatEvent({ type: 'session.updated', sessionId: 'new', patch: { projectId: 'a' } })
      render()
      expect(h.pathname).toBe(pathname)
      expect(h.navigate).not.toHaveBeenCalled()
      if (pathname === '/chat/s') expect(getActiveChatSession().sessionId).toBe('s')
    }
  )

  it('실제 A→B 진입은 B의 cwd를 준비하고 /new 진입은 프로젝트 소속을 해제한다', () => {
    enterProject()
    h.pathname = '/projects/b'
    render()
    render()
    expect(getActiveChatSession()).toMatchObject({ pendingProjectId: 'b', cwd: 'C:/b' })
    h.pathname = '/new'
    render()
    render()
    expect(getActiveChatSession()).toMatchObject({
      pendingProjectId: null,
      sessionId: null,
      messages: []
    })
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it.each(['forkFrom', 'handoffFrom'] as const)(
    '원본 URL 위의 %s 초안은 원본 메타 갱신과 겹쳐도 확정 ID로 이동한다',
    (marker) => {
      h.pathname = '/chat/s'
      render()
      chatActions.newChat()
      const state = useChatStore.getState()
      const entry = state.sessions[state.activeKey]
      useChatStore.setState({
        sessions: {
          ...state.sessions,
          [state.activeKey]: { ...entry, session: { ...entry.session, [marker]: 's' } }
        },
        pendingNewChatKey: state.activeKey
      })
      render()
      ingestChatEvent({ type: 'session.updated', sessionId: 'derived', patch: {} })
      useSessionsStore.setState({ byId: { s: { ...session('s'), title: '원본 제목 갱신' } } })
      render()
      expect(getActiveChatSession().sessionId).toBe('derived')
      expect(h.navigate.mock.calls).toEqual([['/chat/derived', { replace: true }]])
      h.pathname = '/chat/derived'
      render()
      h.pathname = '/chat/s'
      render()
      expect(getActiveChatSession().sessionId).toBe('s')
      expect(h.navigate).toHaveBeenCalledTimes(1)
    }
  )

  it('/new 첫 전송도 draft를 보존한 채 확정 ID로 한 번 이동한다', () => {
    h.pathname = '/new'
    render()
    render()
    sendAndConfirm()
    const before = getActiveChatSession()
    render()
    expect(getActiveChatSession()).toBe(before)
    expect(h.navigate.mock.calls).toEqual([['/chat/new', { replace: true }]])
  })

  it('프로젝트 첫 전송→확정→최근/프로젝트/Nav→실제 URL이 같은 세션을 유지한다', async () => {
    h.includeSync = true
    await sessionsActions.loadProject('a')
    enterProject()
    sendAndConfirm()
    const messages = getActiveChatSession().messages
    await projectsActions.refresh()
    render()
    await vi.waitFor(() => expect(useSessionsStore.getState().recentIds).toContain('new'))
    render()
    const state = useSessionsStore.getState()
    expect(state.projectSessionIds.a).toEqual(['new', 'old'])
    const recent = splitNavSections({ ...state, pinnedProjectIds: new Set() })
    const projects = splitNavSections({ ...state, pinnedProjectIds: new Set(['a']) })
    expect(recent.recent[0]).toBe(state.byId.new)
    expect(projects.projectChildren.a[0]).toBe(state.byId.new)
    expect(h.navigate.mock.calls).toEqual([['/chat/new', { replace: true }]])
    h.pathname = '/chat/new'
    render()
    expect(getActiveChatSession().sessionId).toBe('new')
    expect(getActiveChatSession().messages).toBe(messages)
  })
})
