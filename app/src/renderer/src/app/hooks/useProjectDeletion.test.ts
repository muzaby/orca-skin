import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfirmStore } from '../../shared/ui/confirmDialogStore'

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  pathname: '/projects/p1',
  projects: [
    { id: 'p1', name: '프로젝트 하나' },
    { id: 'p2', name: '프로젝트 둘' }
  ],
  remove: vi.fn(),
  detachSessions: vi.fn(),
  detachChat: vi.fn(),
  removeNav: vi.fn(),
  navigate: vi.fn(),
  alert: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useRef: (value: unknown) => {
    const index = h.cursor++
    h.slots[index] ??= { current: value }
    return h.slots[index]
  },
  useCallback: (callback: unknown, deps: unknown[]) => {
    const index = h.cursor++
    const previous = h.slots[index] as { callback: unknown; deps: unknown[] } | undefined
    if (!previous || deps.some((dep, i) => dep !== previous.deps[i]))
      h.slots[index] = { callback, deps }
    return (h.slots[index] as { callback: unknown }).callback
  }
}))
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useLocation: () => ({ pathname: h.pathname }),
  useNavigate: () => h.navigate
}))
vi.mock('../../features/projects', () => ({
  projectsActions: { remove: h.remove },
  useProjectsState: (select: (state: { list: typeof h.projects }) => unknown) =>
    select({ list: h.projects })
}))
vi.mock('../../features/sessions', () => ({
  sessionsActions: { detachProject: h.detachSessions },
  projectNavActions: { remove: h.removeNav }
}))
vi.mock('../../features/chat', () => ({ chatActions: { detachProject: h.detachChat } }))
vi.mock('../../shared/i18n', async (original) => {
  const actual = await original<typeof import('../../shared/i18n')>()
  return { ...actual, useI18n: () => ({ tr: actual.i18n.t.bind(actual.i18n) }) }
})

const { useProjectDeletion } = await import('./useProjectDeletion')
function DeletionProbe(): ReturnType<typeof useProjectDeletion> {
  return useProjectDeletion()
}
const renderDeletion = (): ReturnType<typeof useProjectDeletion> => {
  h.cursor = 0
  return DeletionProbe()
}
const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  h.slots = []
  h.pathname = '/projects/p1'
  h.projects = [
    { id: 'p1', name: '프로젝트 하나' },
    { id: 'p2', name: '프로젝트 둘' }
  ]
  vi.clearAllMocks()
  h.remove.mockResolvedValue(undefined)
  vi.stubGlobal('window', {
    alert: h.alert,
    location: {
      get pathname(): string {
        return h.pathname
      }
    }
  })
  useConfirmStore.getState().close()
})

describe('project deletion confirmation and completion ownership', () => {
  it('shows the project name and preservation scope; cancellation performs no writes', () => {
    renderDeletion()('p1')
    const request = useConfirmStore.getState().request!
    expect(request.title).toBe('프로젝트 삭제')
    expect(request.message).toContain('프로젝트 하나')
    expect(request.message).toContain('대화와 파일은 유지됩니다')
    expect(request.danger).toBe(true)
    useConfirmStore.getState().close()
    expect(h.remove).not.toHaveBeenCalled()
    expect(h.detachChat).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('waits for the delete API before detaching every mirror and replacing the current page', async () => {
    let resolve!: () => void
    h.remove.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done
      })
    )
    renderDeletion()('p1')
    useConfirmStore.getState().request!.onConfirm()
    expect(h.remove).toHaveBeenCalledExactlyOnceWith('p1')
    expect(h.detachSessions).not.toHaveBeenCalled()
    expect(h.detachChat).not.toHaveBeenCalled()
    expect(h.removeNav).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
    resolve()
    await settle()
    expect(h.detachSessions).toHaveBeenCalledExactlyOnceWith('p1')
    expect(h.detachChat).toHaveBeenCalledExactlyOnceWith('p1')
    expect(h.removeNav).toHaveBeenCalledExactlyOnceWith('p1')
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith('/projects', { replace: true })
  })

  it.each(['/chat/s1', '/projects/p2', '/new', '/projects'])(
    'preserves a newer route %s',
    async (pathname) => {
      let resolve!: () => void
      h.remove.mockReturnValue(
        new Promise<void>((done) => {
          resolve = done
        })
      )
      const requestDelete = renderDeletion()
      requestDelete('p1')
      useConfirmStore.getState().request!.onConfirm()
      h.pathname = pathname
      renderDeletion()
      resolve()
      await settle()
      expect(h.detachChat).toHaveBeenCalledExactlyOnceWith('p1')
      expect(h.navigate).not.toHaveBeenCalled()
    }
  )

  it('a rejected deletion keeps all mirrors and routing, reports failure, and can retry', async () => {
    h.remove.mockRejectedValueOnce(new Error('database unavailable'))
    const requestDelete = renderDeletion()
    requestDelete('p1')
    useConfirmStore.getState().request!.onConfirm()
    await settle()
    expect(h.detachSessions).not.toHaveBeenCalled()
    expect(h.detachChat).not.toHaveBeenCalled()
    expect(h.removeNav).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
    expect(h.alert).toHaveBeenCalledExactlyOnceWith(
      '프로젝트를 삭제하지 못했습니다. 다시 시도해 주세요.'
    )
    requestDelete('p1')
    useConfirmStore.getState().request!.onConfirm()
    await settle()
    expect(h.remove).toHaveBeenCalledTimes(2)
    expect(h.detachChat).toHaveBeenCalledExactlyOnceWith('p1')
  })

  it('coalesces duplicate confirmations of one project while allowing another project', async () => {
    let resolve!: () => void
    h.remove.mockImplementation((id: string) =>
      id === 'p1'
        ? new Promise<void>((done) => {
            resolve = done
          })
        : Promise.resolve()
    )
    const requestDelete = renderDeletion()
    requestDelete('p1')
    const confirm = useConfirmStore.getState().request!.onConfirm
    confirm()
    confirm()
    requestDelete('p1')
    expect(h.remove).toHaveBeenCalledTimes(1)
    requestDelete('p2')
    useConfirmStore.getState().request!.onConfirm()
    await settle()
    expect(h.remove.mock.calls).toEqual([['p1'], ['p2']])
    resolve()
    await settle()
  })

  it('does not confirm a project that no longer exists and reads current names', () => {
    const requestDelete = renderDeletion()
    requestDelete('missing')
    expect(useConfirmStore.getState().request).toBeNull()
    h.projects = [{ id: 'p1', name: '바뀐 이름' }]
    const latestRequestDelete = renderDeletion()
    latestRequestDelete('p1')
    expect(useConfirmStore.getState().request!.message).toContain('바뀐 이름')
  })
})
