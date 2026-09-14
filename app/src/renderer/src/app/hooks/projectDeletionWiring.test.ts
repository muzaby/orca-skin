import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { Project } from '../../../../shared/ipc'
import type { SessionHandlers } from './useSessionHandlers'
import { useConfirmStore } from '../../shared/ui/confirmDialogStore'

const h = vi.hoisted(() => ({
  projects: [] as Project[],
  apiDelete: vi.fn(),
  menus: new Map<string, (event: { stopPropagation: () => void }) => void>(),
  openProject: vi.fn()
}))
vi.mock('../../shared/api/ipc', async (original) => ({
  ...(await original<typeof import('../../shared/api/ipc')>()),
  projectApi: { delete: h.apiDelete, list: async () => h.projects }
}))
vi.mock('../../features/projects/store/projectsStore', async (original) => ({
  ...(await original<typeof import('../../features/projects/store/projectsStore')>()),
  useProjectsState: (select: (state: { list: Project[]; loading: boolean }) => unknown) =>
    select({ list: h.projects, loading: false })
}))
vi.mock('../../features/chat', () => ({
  chatActions: { detachProject: vi.fn() },
  useChatSession: (select: (state: object) => unknown) =>
    select({ sessionId: null, messages: [], loadingSession: false }),
  useChatBusy: () => false,
  useUsageForTelemetryProvider: () => null,
  AgentModeToggle: () => null,
  Composer: () => null
}))
vi.mock('../../features/backend', () => ({
  useBackendCapabilities: () => null,
  useBackendLabel: () => 'Claude'
}))
vi.mock('../../features/settings', () => ({ useOpenSettings: () => vi.fn() }))
vi.mock('../../pages/useSessionActions', () => ({ useSessionActions: () => ({}) }))
vi.mock('../SidebarUserButton', () => ({ SidebarUserButton: () => null }))
vi.mock('../../features/projects/components/EditInstructionsModal', () => ({
  EditInstructionsModal: () => null
}))
// Node has no portal host. Keep the real menu callback tree, exposing only the portal boundary.
// This checks wiring/event ownership, while the browser gate checks open/close and focus behavior.
vi.mock('../../shared/ui/Popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => children
}))
vi.mock('../../shared/ui/MenuItem', () => ({
  MenuItem: (props: {
    children: ReactNode
    'data-project-delete'?: string
    onClick: (event: { stopPropagation: () => void }) => void
  }) => {
    const id = props['data-project-delete']
    if (id) h.menus.set(id, props.onClick)
    return createElement('span', null, props.children)
  }
}))

const { AppRouter } = await import('../router')
const { useSidebarSlots } = await import('./useSidebarSlots')
const { useProjectDeletion } = await import('./useProjectDeletion')

const noop = (): void => {}
const project = (id: string, pinnedAt: number | null): Project => ({
  id,
  name: id,
  pinnedAt,
  instructions: '',
  cwd: null,
  createdAt: 1,
  updatedAt: 1
})
function Probe({ surface }: { surface: 'nav' | 'pinned' | 'hero' }): React.JSX.Element {
  const onDeleteProject = useProjectDeletion()
  const handlers: SessionHandlers = {
    currentSessionId: null,
    handleSelectSession: noop,
    handleDeleteSession: noop,
    handleRenameSession: noop,
    navProjects: [h.projects[0]!],
    pinnedProjects: [h.projects[1]!],
    navProjectIds: new Set(h.projects.map((item) => item.id)),
    pinnedProjectIds: new Set([h.projects[1]!.id]),
    handleTogglePinSession: noop,
    handleTogglePinProject: noop,
    handleOpenProject: h.openProject,
    draftSessions: [],
    activeDraftKey: null,
    handleSelectDraft: noop,
    handleDeleteDraft: noop
  }
  const slots = useSidebarSlots(handlers, onDeleteProject)
  if (surface === 'hero')
    return createElement(AppRouter, {
      artifactCatalog: { onOpen: noop, onDeleted: noop },
      onDeleteProject
    })
  return createElement('div', null, surface === 'nav' ? slots.projectsSlot : slots.pinnedSlot)
}

beforeEach(() => {
  h.projects = [project('nav-project', null), project('pinned-project', 1)]
  h.menus.clear()
  vi.clearAllMocks()
  h.apiDelete.mockResolvedValue(undefined)
  vi.stubGlobal('window', { alert: vi.fn(), location: { pathname: '/' } })
  useConfirmStore.getState().close()
})
afterEach(() => vi.unstubAllGlobals())

describe('actual project menu wiring to the delete IPC (EP-02)', () => {
  it.each([
    ['nav', 'nav-project'],
    ['pinned', 'pinned-project'],
    ['hero', 'nav-project']
  ] as const)(
    '%s sends its project through menu, shared confirmation, and API',
    async (surface, id) => {
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: ['/projects/nav-project'] },
          createElement(Probe, { surface })
        )
      )
      const onClick = h.menus.get(id)
      expect(onClick).toBeTypeOf('function')
      const event = { stopPropagation: vi.fn() }
      onClick!(event)
      expect(event.stopPropagation).toHaveBeenCalledOnce()
      expect(h.openProject).not.toHaveBeenCalled()
      expect(h.apiDelete).not.toHaveBeenCalled()
      const request = useConfirmStore.getState().request!
      expect(request).not.toBeNull()
      expect(request.message).toContain(id)
      request.onConfirm()
      await Promise.resolve()
      await Promise.resolve()
      expect(h.apiDelete).toHaveBeenCalledExactlyOnceWith(id)
    }
  )
})
