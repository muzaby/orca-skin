import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { fixture } = vi.hoisted(() => ({
  fixture: {
    session: {
      agentKind: 'coding' as 'coding' | 'work',
      sessionId: null as string | null,
      messages: [] as unknown[],
      loadingSession: false,
      inflight: false
    },
    draft: '/검토 기존 초안'
  }
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: { composerDraft: fixture.draft } }),
  useParams: () => ({ projectId: 'project-r3' }),
  useNavigate: () => vi.fn()
}))

// 페이지의 실제 배치를 본다. feature 내부 수명/상호작용은 native 인수의 별도 범위다.
vi.mock('../features/chat', () => ({
  useChatSession: (select: (state: typeof fixture.session) => unknown) => select(fixture.session),
  useChatBusy: () => fixture.session.inflight,
  useUsageForTelemetryProvider: () => null,
  AgentModeToggle: () => createElement('div', { 'data-component': 'AgentModeToggle' }),
  Composer: (props: { initialDraft?: string; showLandingCwdPanel?: boolean; flush?: boolean }) =>
    createElement('div', {
      'data-component': 'Composer',
      'data-initial-draft': props.initialDraft,
      'data-landing-cwd': String(props.showLandingCwdPanel),
      'data-flush': String(props.flush)
    }),
  ChatTile: () => createElement('div', { 'data-component': 'ChatTile' }),
  RightPanel: () => createElement('div', { 'data-component': 'RightPanel' })
}))

vi.mock('../features/backend', () => ({
  useBackendCapabilities: () => null,
  useBackendLabel: () => 'Claude'
}))
vi.mock('../features/settings', () => ({
  useOpenSettings: () => vi.fn(),
  providerTabId: (key: string) => key
}))
vi.mock('../features/projects', () => ({
  ProjectInfoHero: () => createElement('div', { 'data-component': 'ProjectInfoHero' }),
  ProjectInstructionsSidebar: () =>
    createElement('div', { 'data-component': 'ProjectInstructionsSidebar' }),
  ProjectLandingHeader: () => createElement('div', { 'data-component': 'ProjectLandingHeader' }),
  useProjectsState: (select: (state: { list: { id: string; name: string }[] }) => unknown) =>
    select({ list: [{ id: 'project-r3', name: '회귀 프로젝트' }] })
}))
vi.mock('../features/sessions', () => ({
  ProjectSessionsPanel: () => createElement('div', { 'data-component': 'ProjectSessionsPanel' })
}))
vi.mock('./useSessionActions', () => ({ useSessionActions: () => ({}) }))

const { NewChatLandingPage } = await import('./NewChatLandingPage')
const { ProjectLandingPage } = await import('./ProjectLandingPage')

beforeEach(() => {
  fixture.session = {
    agentKind: 'coding',
    sessionId: null,
    messages: [],
    loadingSession: false,
    inflight: false
  }
})

const pages = [
  { label: '새 대화', Page: NewChatLandingPage },
  { label: '프로젝트', Page: ProjectLandingPage }
]

describe.each(pages)('0224 r3 — $label 랜딩 배치 (AC-R3-3 · EP3)', ({ Page }) => {
  it.each(['coding', 'work'] as const)(
    '%s 랜딩은 패널 없이 같은 Composer 계약을 유지한다',
    (kind) => {
      fixture.session.agentKind = kind
      const html = renderToStaticMarkup(createElement(Page))
      expect(html.match(/data-component="Composer"/g)).toHaveLength(1)
      expect(html.match(/data-component="AgentModeToggle"/g)).toHaveLength(1)
      expect(html.indexOf('data-component="AgentModeToggle"')).toBeLessThan(
        html.indexOf('data-component="Composer"')
      )
      expect(html).not.toContain('어떤 작업을 시작할까요?')
      expect(html).not.toContain('개발, 디버깅을 시작하세요.')
      expect(html).toContain('data-landing-cwd="true"')
      expect(html).not.toContain('data-component="RightPanel"')
      expect(html).not.toContain('data-component="ChatTile"')
    }
  )

  it('첫 메시지가 생기면 랜딩 Composer에서 대화 타일로 전환한다', () => {
    fixture.session.agentKind = 'work'
    fixture.session.messages = [{ role: 'user', text: '시작' }]
    const html = renderToStaticMarkup(createElement(Page))
    expect(html.match(/data-component="ChatTile"/g)).toHaveLength(1)
    expect(html).not.toContain('data-component="Composer"')
    expect(html).not.toContain('data-component="AgentModeToggle"')
  })
})

it('새 대화의 prefill과 프로젝트의 지침·세션 목록 배치를 보존한다', () => {
  fixture.session.agentKind = 'work'
  const fresh = renderToStaticMarkup(createElement(NewChatLandingPage))
  expect(fresh).toContain('data-initial-draft="/검토 기존 초안"')
  const project = renderToStaticMarkup(createElement(ProjectLandingPage))
  expect(project).toContain('data-component="ProjectInstructionsSidebar"')
  expect(project.indexOf('data-component="ProjectInfoHero"')).toBeLessThan(
    project.indexOf('data-component="AgentModeToggle"')
  )
  expect(project).toContain('data-component="ProjectSessionsPanel"')
  expect(project).toContain('data-flush="true"')
})
