import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'

const sessionList = vi.hoisted(() => vi.fn())
const sessionRename = vi.hoisted(() => vi.fn())
const sessionDelete = vi.hoisted(() => vi.fn())
const projectListSessions = vi.hoisted(() => vi.fn())

vi.mock('../../../shared/api/ipc', () => ({
  sessionApi: {
    list: sessionList,
    delete: sessionDelete,
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
    sessionDelete.mockReset()
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

// 삭제 결과 union 의 **소비자** — VP-03 선언 경로(`delete click → handler → proof → remove/db`)의
// 마지막 hop 이다. main 이 worktree 를 보존하며 삭제를 거부해도(AC15) renderer 가 그 결과를
// 무시하면 세션은 목록에서 사라지고 사용자는 이유를 못 본다(verify r12 D35).
//
// `ok` 두 방향을 같은 축에서 본다 — 성공만 단언하면 `if (!result.ok)` 를 통째로 지워도 초록이다.
describe('sessionsStore.remove — 보존 결과를 화면이 소비한다 (AC15 · VP-03)', () => {
  const alert = vi.fn()

  beforeEach(async () => {
    vi.stubGlobal('window', { alert })
    alert.mockReset()
    sessionList.mockResolvedValue([session('s1', '남을 세션', 'p1')])
    projectListSessions.mockResolvedValue([session('s1', '남을 세션', 'p1')])
    await initSessions()
    await sessionsActions.loadProject('p1')
  })

  it('보존 이유가 오면 목록에 그대로 남고 이유를 보여준다', async () => {
    sessionDelete.mockResolvedValue({
      ok: false,
      reason: 'worktree-dirty',
      message: '커밋하지 않은 변경이 있어 삭제하지 않았습니다.'
    })

    await expect(sessionsActions.remove('s1')).resolves.toBe(false)

    const state = useSessionsStore.getState()
    expect(state.byId.s1).toBeDefined()
    expect(state.recentIds).toEqual(['s1'])
    expect(state.projectSessionIds.p1).toEqual(['s1'])
    expect(alert).toHaveBeenCalledWith('커밋하지 않은 변경이 있어 삭제하지 않았습니다.')
  })

  it('성공하면 세 버킷에서 모두 빠지고 안내하지 않는다', async () => {
    sessionDelete.mockResolvedValue({ ok: true })

    await expect(sessionsActions.remove('s1')).resolves.toBe(true)

    const state = useSessionsStore.getState()
    expect(state.byId.s1).toBeUndefined()
    expect(state.recentIds).toEqual([])
    expect(state.projectSessionIds.p1).toEqual([])
    expect(alert).not.toHaveBeenCalled()
  })
})
