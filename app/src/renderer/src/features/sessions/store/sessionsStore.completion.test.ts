import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'
const api = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }))
vi.mock('../../../shared/api/ipc', () => ({
  sessionApi: { list: api.list, delete: api.remove },
  projectApi: {}
}))
import { sessionsActions, useSessionsStore } from './sessionsStore'
const row: SessionListItem = {
  id: 's',
  backend: 'claude',
  title: 'reply',
  updatedAt: 1,
  preview: null,
  projectId: null,
  cwd: null,
  pinnedAt: null
}
beforeEach(() => {
  useSessionsStore.setState({
    byId: { s: row },
    recentIds: ['s'],
    projectSessionIds: {},
    loading: false,
    unseenCompletedIds: new Set(),
    viewedSessionId: null
  })
  api.list.mockResolvedValue([row])
  api.remove.mockResolvedValue({ ok: true })
})
describe('r5 unseen normal completion lifecycle', () => {
  it('only non-viewed completion marks and repeated completion is idempotent', () => {
    sessionsActions.setViewedSession('other')
    sessionsActions.markCompleted('s')
    const marked = useSessionsStore.getState()
    expect(marked.unseenCompletedIds.has('s')).toBe(true)
    sessionsActions.markCompleted('s')
    expect(useSessionsStore.getState()).toBe(marked)
  })
  it('viewing clears completion and leaving does not resurrect it', () => {
    sessionsActions.markCompleted('s')
    sessionsActions.setViewedSession('s')
    expect(useSessionsStore.getState().unseenCompletedIds.has('s')).toBe(false)
    sessionsActions.markCompleted('s')
    sessionsActions.setViewedSession(null)
    expect(useSessionsStore.getState().unseenCompletedIds.has('s')).toBe(false)
  })
  it('recent metadata refresh preserves the independent marker', async () => {
    sessionsActions.markCompleted('s')
    await sessionsActions.refresh()
    expect(useSessionsStore.getState().unseenCompletedIds.has('s')).toBe(true)
  })
  it('successful deletion clears the marker', async () => {
    sessionsActions.markCompleted('s')
    await sessionsActions.remove('s')
    expect(useSessionsStore.getState().unseenCompletedIds.has('s')).toBe(false)
    expect(useSessionsStore.getState().byId.s).toBeUndefined()
  })
})
