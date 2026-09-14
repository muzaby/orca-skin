import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'
import { splitNavSections } from '../lib/navSections'

const api = vi.hoisted(() => ({ list: vi.fn(), listSessions: vi.fn() }))
vi.mock('../../../shared/api/ipc', () => ({
  sessionApi: { list: api.list },
  projectApi: { listSessions: api.listSessions }
}))

function session(id: string, projectId: string | null, updatedAt = 1): SessionListItem {
  return {
    id,
    projectId,
    updatedAt,
    title: id,
    agentKind: 'code',
    backend: 'claude',
    preview: null,
    cwd: '/keep',
    pinnedAt: null
  }
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('project membership receives recent and project snapshots together', () => {
  beforeEach(() => {
    vi.resetModules()
    api.list.mockReset().mockResolvedValue([])
    api.listSessions.mockReset().mockResolvedValue([])
  })

  it('recent notification includes new project membership, keeps history and updates Nav partitions', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    const old = session('old', 'p', 1)
    api.listSessions.mockResolvedValue([old])
    await sessionsActions.loadProject('p')
    const newest = session('new', 'p', 3)
    const pinned = { ...session('pinned', 'p', 2), pinnedAt: 4 }
    api.list.mockResolvedValue([newest, pinned])
    const snapshots: ReturnType<typeof useSessionsStore.getState>[] = []
    const off = useSessionsStore.subscribe((state) => snapshots.push(state))
    await sessionsActions.refresh()
    off()
    expect(snapshots).toHaveLength(1)
    const state = snapshots[0]
    expect(state.recentIds).toEqual(['new', 'pinned'])
    expect(state.projectSessionIds.p).toEqual(['new', 'pinned', 'old'])
    expect(state.byId.old).toBe(old)
    const nav = splitNavSections({ ...state, pinnedProjectIds: new Set(['p']) })
    expect(nav.projectChildren.p).toEqual([newest, old])
    expect(nav.projectChildren.p[0]).toBe(state.byId.new)
    expect(nav.pinned).toEqual([pinned])
    expect(nav.recent).toEqual([])
  })

  it('recent membership removes moved sessions and never marks an unqueried project as loaded', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    api.listSessions.mockResolvedValue([session('moved', 'p')])
    await sessionsActions.loadProject('p')
    api.listSessions.mockResolvedValue([])
    await sessionsActions.loadProject('empty')
    const empty = useSessionsStore.getState().projectSessionIds.empty
    api.list.mockResolvedValue([session('moved', 'unqueried', 2)])
    await sessionsActions.refresh()
    const state = useSessionsStore.getState()
    expect(state.projectSessionIds.p).toEqual([])
    expect(state.projectSessionIds.empty).toBe(empty)
    expect(state.projectSessionIds.unqueried).toBeUndefined()
    expect(state.byId.moved.projectId).toBe('unqueried')
  })

  it('late project response cannot discard a newer recent row or overwrite its metadata and membership', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    const response = deferred<SessionListItem[]>()
    api.listSessions.mockReturnValue(response.promise)
    const pending = sessionsActions.loadProject('p')
    const updated = { ...session('updated', 'p', 4), title: 'latest title' }
    const created = session('created', 'p', 5)
    api.list.mockResolvedValue([created, updated, session('moved', null, 3)])
    await sessionsActions.refresh()
    response.resolve([session('updated', 'p'), session('moved', 'p'), session('old', 'p')])
    await pending
    const state = useSessionsStore.getState()
    expect(state.projectSessionIds.p).toEqual(['created', 'updated', 'old'])
    expect(state.byId.updated).toBe(updated)
    expect(state.byId.created).toBe(created)
    expect(state.byId.moved.projectId).toBeNull()
  })

  it('project-first response also converges when recent arrives later and no-op refresh preserves references', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    api.listSessions.mockResolvedValue([session('old', 'p')])
    await sessionsActions.loadProject('p')
    api.list.mockImplementation(async () => [session('new', 'p', 2)])
    await sessionsActions.refresh()
    expect(useSessionsStore.getState().projectSessionIds.p).toEqual(['new', 'old'])
    const before = useSessionsStore.getState()
    await sessionsActions.refresh()
    expect(useSessionsStore.getState()).toBe(before)
  })

  it('late project response with the same reconciled membership preserves the state reference', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    const old = session('old', 'p')
    api.listSessions.mockResolvedValue([old])
    await sessionsActions.loadProject('p')
    const response = deferred<SessionListItem[]>()
    api.listSessions.mockReturnValue(response.promise)
    const pending = sessionsActions.loadProject('p')
    api.list.mockResolvedValue([session('new', 'p', 2)])
    await sessionsActions.refresh()
    const before = useSessionsStore.getState()
    response.resolve([old])
    await pending
    expect(useSessionsStore.getState()).toBe(before)
  })

  it('project deletion detaches only association and blocks both late response boundaries', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    const existing = session('existing', 'p')
    const other = session('other', 'q')
    useSessionsStore.setState({
      byId: { existing, other },
      recentIds: ['existing', 'other'],
      projectSessionIds: { p: ['existing'], q: ['other'] },
      loading: false,
      unseenCompletedIds: new Set(['existing']),
      viewedSessionId: 'existing'
    })
    const before = useSessionsStore.getState()
    const recent = deferred<SessionListItem[]>()
    const project = deferred<SessionListItem[]>()
    api.list.mockReturnValue(recent.promise)
    api.listSessions.mockReturnValue(project.promise)
    const recentPending = sessionsActions.refresh()
    const projectPending = sessionsActions.loadProject('p')
    sessionsActions.detachProject('p')
    const detached = useSessionsStore.getState()
    expect(detached.byId.existing).toEqual({ ...existing, projectId: null })
    expect(detached.byId.other).toBe(other)
    expect(detached.projectSessionIds.p).toBeUndefined()
    expect(detached.projectSessionIds.q).toBe(before.projectSessionIds.q)
    expect(detached.recentIds).toBe(before.recentIds)
    expect(detached.unseenCompletedIds).toBe(before.unseenCompletedIds)
    expect(detached.viewedSessionId).toBe('existing')
    project.resolve([existing, session('late', 'p')])
    await projectPending
    recent.resolve([existing, other, session('late', 'p')])
    await recentPending
    expect(useSessionsStore.getState().byId.existing.projectId).toBeNull()
    expect(useSessionsStore.getState().byId.late.projectId).toBeNull()
    expect(useSessionsStore.getState().projectSessionIds.p).toBeUndefined()
    await sessionsActions.loadProject('p')
    expect(api.listSessions).toHaveBeenCalledTimes(1)
    api.listSessions.mockResolvedValue([session('replacement', 'new-uuid')])
    await sessionsActions.loadProject('new-uuid')
    expect(useSessionsStore.getState().projectSessionIds['new-uuid']).toEqual(['replacement'])
  })

  it('late failed project response cannot re-create the deleted empty membership', async () => {
    const { sessionsActions, useSessionsStore } = await import('./sessionsStore')
    const response = deferred<SessionListItem[]>()
    api.listSessions.mockReturnValue(response.promise)
    const pending = sessionsActions.loadProject('p')
    sessionsActions.detachProject('p')
    response.reject(new Error('unavailable'))
    await expect(pending).rejects.toThrow('unavailable')
    expect(useSessionsStore.getState().projectSessionIds.p).toBeUndefined()
  })
})
