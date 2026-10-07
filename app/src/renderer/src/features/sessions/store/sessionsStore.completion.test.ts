import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'
const api = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }))
vi.mock('../../../shared/api/ipc', () => ({
  sessionApi: { list: api.list, delete: api.remove },
  projectApi: {}
}))
import { sessionsActions, useSessionsStore } from './sessionsStore'
const row: SessionListItem = {
  agentKind: 'code',
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
    unseenAttention: new Map(),
    generatingSessionIds: new Set(),
    viewedSessionId: null
  })
  api.list.mockResolvedValue([row])
  api.remove.mockResolvedValue({ ok: true })
})
describe('r5 unseen normal completion lifecycle', () => {
  it('0254 generating membership preserves store and set identity across equal sets', () => {
    sessionsActions.setGeneratingSessions(new Set(['s', 'other']))
    const state = useSessionsStore.getState()
    sessionsActions.setGeneratingSessions(new Set(['other', 's']))
    expect(useSessionsStore.getState()).toBe(state)
    expect(useSessionsStore.getState().generatingSessionIds).toBe(state.generatingSessionIds)
    sessionsActions.setGeneratingSessions(new Set(['s']))
    expect(useSessionsStore.getState().generatingSessionIds).toEqual(new Set(['s']))
  })
  it.each(['completed', 'awaiting-response'] as const)('the last reason wins after %s', (first) => {
    const actions = {
      completed: sessionsActions.markCompleted,
      'awaiting-response': sessionsActions.markAwaitingResponse
    }
    const last = first === 'completed' ? 'awaiting-response' : 'completed'
    actions[first]('s')
    expect(useSessionsStore.getState().unseenAttention.get('s')).toBe(first)
    actions[last]('s')
    const state = useSessionsStore.getState()
    expect(state.unseenAttention.get('s')).toBe(last)
    actions[last]('s')
    expect(useSessionsStore.getState()).toBe(state)
  })
  it('viewing acknowledges an awaiting response and metadata refresh preserves it until then', async () => {
    sessionsActions.markAwaitingResponse('s')
    await sessionsActions.refresh()
    expect(useSessionsStore.getState().unseenAttention.get('s')).toBe('awaiting-response')
    sessionsActions.setViewedSession('s')
    sessionsActions.markAwaitingResponse('s')
    sessionsActions.setViewedSession(null)
    expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(false)
  })
  it('deletion clears an awaiting response', async () => {
    sessionsActions.markAwaitingResponse('s')
    await sessionsActions.remove('s')
    expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(false)
  })
  it('only non-viewed completion marks and repeated completion is idempotent', () => {
    sessionsActions.setViewedSession('other')
    sessionsActions.markCompleted('s')
    const marked = useSessionsStore.getState()
    expect(marked.unseenAttention.has('s')).toBe(true)
    sessionsActions.markCompleted('s')
    expect(useSessionsStore.getState()).toBe(marked)
  })
  it('viewing clears completion and leaving does not resurrect it', () => {
    sessionsActions.markCompleted('s')
    sessionsActions.setViewedSession('s')
    expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(false)
    sessionsActions.markCompleted('s')
    sessionsActions.setViewedSession(null)
    expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(false)
  })
  it('recent metadata refresh preserves the independent marker', async () => {
    sessionsActions.markCompleted('s')
    await sessionsActions.refresh()
    expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(true)
  })
  it('successful deletion clears the marker', async () => {
    sessionsActions.markCompleted('s')
    await sessionsActions.remove('s')
    expect(useSessionsStore.getState().unseenAttention.has('s')).toBe(false)
    expect(useSessionsStore.getState().byId.s).toBeUndefined()
  })
})
