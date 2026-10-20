import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  session: {
    pendingProjectId: null,
    projectId: 'shared-A',
    backend: 'claude',
    messages: [{ role: 'user' }],
    loadingSession: false,
    inflight: false
  },
  projects: [
    { id: 'other', name: '다른 프로젝트', cwd: '/wrong' },
    { id: 'shared-A', name: '공유 프로젝트', cwd: '/project-root' }
  ]
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ state: null }),
  useParams: () => ({ projectId: 'shared-A' })
}))
vi.mock('../features/chat/components/ChatTile', () => ({
  ChatTile: ({
    projectName,
    projectPath
  }: {
    projectName?: string | null
    projectPath?: string | null
  }) => createElement('div', { 'data-project-name': projectName, 'data-project-path': projectPath })
}))
vi.mock('../features/chat', async () => ({
  ChatView: (await import('../features/chat/components/ChatView')).ChatView,
  ChatTile: (await import('../features/chat/components/ChatTile')).ChatTile,
  useChatSession: (select: (session: typeof fixture.session) => unknown) => select(fixture.session),
  useChatBusy: () => false,
  useUsageForTelemetryProvider: () => null,
  Landing: () => null,
  LandingHeader: () => null,
  Composer: () => null
}))
vi.mock('../features/projects', () => ({
  useProjectsState: (
    select: (state: { list: typeof fixture.projects; loading: boolean }) => unknown
  ) => select({ list: fixture.projects, loading: false }),
  ProjectInfoHero: () => null,
  projectsActions: {}
}))
vi.mock('../features/sessions', () => ({ ProjectSessionsPanel: () => null }))
vi.mock('../features/backend', () => ({
  useBackendLabel: () => 'Claude',
  useBackendCapabilities: () => null
}))
vi.mock('../features/settings', () => ({
  useOpenSettings: () => () => {},
  providerTabId: () => ''
}))
vi.mock('./useSessionActions', () => ({ useSessionActions: () => ({}) }))
import { ChatPage } from './ChatPage'
import { NewChatLandingPage } from './NewChatLandingPage'
import { ProjectLandingPage } from './ProjectLandingPage'

it.each([
  ['chat', () => createElement(ChatPage)],
  ['new', () => createElement(NewChatLandingPage)],
  ['project', () => createElement(ProjectLandingPage, { onDeleteProject: () => {} })]
] as const)(
  'passes the live catalog project name and rename through the %s page',
  (_name, render) => {
    fixture.projects[1].name = '공유 프로젝트'
    fixture.projects[1].cwd = '/project-root'
    expect(renderToStaticMarkup(render())).toContain('data-project-path="/project-root"')
    expect(renderToStaticMarkup(render())).toContain('data-project-name="공유 프로젝트"')
    fixture.projects[1].name = '바뀐 프로젝트'
    fixture.projects[1].cwd = '/changed-root'
    expect(renderToStaticMarkup(render())).toContain('data-project-path="/changed-root"')
    expect(renderToStaticMarkup(render())).toContain('data-project-name="바뀐 프로젝트"')
  }
)
