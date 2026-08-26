import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'

const sessionList = vi.hoisted(() => vi.fn())
const sessionRename = vi.hoisted(() => vi.fn())
const projectListSessions = vi.hoisted(() => vi.fn())

vi.mock('../../../shared/api/ipc', () => ({
  sessionApi: {
    list: sessionList,
    delete: vi.fn(),
    rename: sessionRename,
    setPinned: vi.fn(),
    onTitle: vi.fn(() => () => undefined)
  },
  projectApi: { listSessions: projectListSessions }
}))

const { initSessions, sessionsActions, useSessionsStore } = await import('./sessionsStore')

function session(id: string, title: string, projectId: string | null = null): SessionListItem {
  return {
    id,
    backend: 'claude',
    title,
    updatedAt: 1,
    preview: null,
    projectId,
    cwd: null,
    pinnedAt: null
  }
}

describe('sessionsStore single entity source', () => {
  beforeEach(() => {
    useSessionsStore.setState({
      byId: {},
      recentIds: [],
      projectSessionIds: {},
      loading: true
    })
    sessionList.mockReset()
    sessionRename.mockReset().mockResolvedValue(undefined)
    projectListSessions.mockReset()
  })

  it('recent와 project membership이 동일한 세션 객체를 가리킨다', async () => {
    sessionList.mockResolvedValue([session('s1', 'recent', 'p1')])
    projectListSessions.mockResolvedValue([
      session('s1', 'project', 'p1'),
      session('s2', 'old', 'p1')
    ])

    await initSessions()
    await sessionsActions.loadProject('p1')

    const state = useSessionsStore.getState()
    expect(state.recentIds).toEqual(['s1'])
    expect(state.projectSessionIds.p1).toEqual(['s1', 's2'])
    expect(state.byId.s1.title).toBe('project')
  })

  it('rename은 프로젝트 전용 세션도 공용 엔티티에서 즉시 갱신한다', async () => {
    projectListSessions.mockResolvedValue([session('s2', 'before', 'p1')])
    await sessionsActions.loadProject('p1')

    await sessionsActions.rename('s2', 'after')

    const state = useSessionsStore.getState()
    expect(state.byId.s2.title).toBe('after')
    expect(state.projectSessionIds.p1.map((id) => state.byId[id].title)).toEqual(['after'])
  })
})
