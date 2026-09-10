import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import type { Project, SessionListItem } from '../../../../shared/ipc'
import type { Tweaks } from '../../shared/theme/TweakProvider'
import { useSessionsStore } from '../../features/sessions/store/sessionsStore'
import { Sidebar } from '../Sidebar'
import { useSessionHandlers, type SessionHandlers } from './useSessionHandlers'
import { useSidebarSlots } from './useSidebarSlots'

const h = vi.hoisted(() => ({
  projects: [] as Project[],
  navigate: vi.fn(),
  pinProject: vi.fn(),
  selectDraft: vi.fn(),
  deleteDraft: vi.fn()
}))
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/new' }),
  useNavigate: () => h.navigate,
  matchPath: () => null
}))
vi.mock('../../shared/theme', () => ({
  useTweakContext: (selector: (t: Partial<Tweaks>) => unknown) => ({
    t: selector({ sidebarCollapsed: false, sidebarWidth: 320 }),
    setTweak: vi.fn()
  })
}))
vi.mock('../SidebarUserButton', () => ({ SidebarUserButton: () => null }))
vi.mock('../../features/projects', () => ({
  useProjectsState: (selector: (s: { list: Project[] }) => unknown) =>
    selector({ list: h.projects }),
  projectsActions: { setPinned: h.pinProject }
}))
vi.mock('../../features/chat', () => ({
  chatActions: {
    handleSessionDeleted: vi.fn(),
    renameSession: vi.fn(),
    loadSession: vi.fn(),
    activateContinuityDraft: h.selectDraft,
    discardContinuityDraft: h.deleteDraft
  },
  useActiveDraftKey: () => null,
  useDraftSessionRows: () => [
    {
      key: 'draft-1',
      title: '분기 초안',
      agentKind: 'work',
      projectId: null,
      parentSessionId: 'parent'
    }
  ]
}))

let handlers: SessionHandlers
function Probe({ observe }: { observe: (handlers: SessionHandlers) => void }): React.JSX.Element {
  const current = useSessionHandlers()
  observe(current)
  return createElement(Sidebar, useSidebarSlots(current))
}
const snapshot = useSessionsStore.getInitialState()
const original = { ...snapshot }
const project = (id: string, pinnedAt: number | null, cwd: string): Project => ({
  id,
  name: 'Desktop',
  instructions: '',
  cwd,
  pinnedAt,
  createdAt: 0,
  updatedAt: 0
})
const session = (
  id: string,
  projectId: string | null,
  pinnedAt: number | null
): SessionListItem => ({
  id,
  title: id,
  projectId,
  pinnedAt,
  backend: 'claude',
  agentKind: 'work',
  updatedAt: 0,
  preview: null,
  cwd: null
})
const render = (): ReturnType<typeof load> =>
  load(
    renderToStaticMarkup(
      createElement(Probe, {
        observe: (current) => {
          handlers = current
        }
      })
    )
  )
beforeEach(() => {
  Object.assign(snapshot, original)
  vi.clearAllMocks()
  h.projects = [project('a', null, 'C:\\A\\Desktop'), project('b', 1, 'C:\\B\\Desktop')]
  const sessions = [
    session('unassigned', null, null),
    session('plain-child', 'a', null),
    session('pinned-child', 'b', null),
    session('pinned-chat', 'b', 1)
  ]
  snapshot.byId = Object.fromEntries(sessions.map((s) => [s.id, s]))
  snapshot.recentIds = sessions.map((s) => s.id)
  snapshot.projectSessionIds = { a: ['plain-child'], b: ['pinned-child', 'pinned-chat'] }
  h.pinProject.mockImplementation(async (id: string, pinned: boolean) => {
    h.projects = h.projects.map((p) => (p.id === id ? { ...p, pinnedAt: pinned ? 2 : null } : p))
  })
})
afterEach(() => Object.assign(snapshot, original))

describe('actual sidebar project and recent composition', () => {
  it('puts pinned projects and chats under one header, followed by projects and recent sessions', () => {
    const $ = render()
    const groups = $('.app-frame-sidebar-scroll')
      .children()
      .map((_, el) => $(el).attr('data-context'))
      .get()
    expect(groups).toEqual(['pinned', 'projects', 'recents'])
    expect($('[data-context="pinned"] > button').text()).toBe('고정됨')
    expect(
      $('[data-context="pinned"] [data-project-id]')
        .map((_, el) => $(el).attr('data-project-id'))
        .get()
    ).toEqual(['b'])
    expect(
      $('[data-context="projects"] [data-project-id]')
        .map((_, el) => $(el).attr('data-project-id'))
        .get()
    ).toEqual(['a'])
    expect($('[data-context="pinned"] [data-session-id="pinned-chat"]')).toHaveLength(1)
    expect(
      $('[data-context="recents"] [data-session-id]')
        .map((_, el) => $(el).attr('data-session-id'))
        .get()
    ).toEqual(['draft-1', 'unassigned', 'plain-child'])
    for (const [id, cwd] of [
      ['a', 'C:\\A\\Desktop'],
      ['b', 'C:\\B\\Desktop']
    ]) {
      const row = $(`[data-project-id="${id}"]`)
      expect(row.find('[data-project-name]').text()).toBe('Desktop')
      expect(row.find('[data-project-name]').next('[data-project-path]').text()).toBe(cwd)
      expect(row.find('[data-project-path]').hasClass('text-[10.5px]')).toBe(true)
    }
  })

  it('pin and unpin actions move the project and preserve the original recent partition', async () => {
    render()
    handlers.handleTogglePinProject('a', true)
    await Promise.resolve()
    let $ = render()
    expect($('[data-context="pinned"] [data-project-id="a"]')).toHaveLength(1)
    expect($('[data-context="projects"] [data-project-id="a"]')).toHaveLength(0)
    expect($('[data-context="recents"] [data-session-id="plain-child"]')).toHaveLength(0)
    handlers.handleTogglePinProject('a', false)
    await Promise.resolve()
    $ = render()
    expect($('[data-context="pinned"] [data-project-id="a"]')).toHaveLength(0)
    expect($('[data-context="projects"] [data-project-id="a"]')).toHaveLength(1)
    expect($('[data-context="recents"] [data-session-id="plain-child"]')).toHaveLength(1)
    expect($('[data-context="recents"] [data-session-id="unassigned"]')).toHaveLength(1)
    expect(h.pinProject.mock.calls).toEqual([
      ['a', true],
      ['a', false]
    ])
  })

  it('restored recent actions reopen existing sessions and continuity drafts without reassignment', () => {
    render()
    handlers.handleSelectSession('unassigned')
    expect(h.navigate).toHaveBeenCalledWith('/chat/unassigned')
    h.selectDraft.mockReturnValue('parent')
    handlers.handleSelectDraft('draft-1')
    handlers.handleDeleteDraft('draft-1')
    expect(h.navigate).toHaveBeenCalledWith('/chat/parent')
    expect(h.deleteDraft).toHaveBeenCalledWith('draft-1')
    expect(h.pinProject).not.toHaveBeenCalled()
  })
})
