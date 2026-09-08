import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem } from '../../../../../shared/ipc'
import { splitNavSections } from '../lib/navSections'

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

  it('동일한 최근/프로젝트 응답과 이름 patch는 참조와 구독 결과를 보존한다', async () => {
    sessionList.mockImplementation(async () => [session('s1', 'one', 'p1')])
    projectListSessions.mockImplementation(async () => [session('s1', 'one', 'p1')])
    await initSessions()
    await sessionsActions.loadProject('p1')
    const before = useSessionsStore.getState()
    const notify = vi.fn()
    const off = useSessionsStore.subscribe(notify)
    try {
      await initSessions()
      await sessionsActions.loadProject('p1')
      await sessionsActions.rename('s1', 'one')
      expect(useSessionsStore.getState()).toBe(before)
      expect(notify).not.toHaveBeenCalled()
    } finally {
      off()
    }
  })

  it('바뀐 행만 교체하고 같은 ID 순서와 프로젝트 membership은 유지한다', async () => {
    sessionList.mockResolvedValue([session('s1', 'one'), session('s2', 'two', 'p1')])
    await initSessions()
    projectListSessions.mockResolvedValue([session('s2', 'two', 'p1')])
    await sessionsActions.loadProject('p1')
    const before = useSessionsStore.getState()
    sessionList.mockResolvedValue([session('s1', 'changed'), session('s2', 'two', 'p1')])
    await initSessions()
    const after = useSessionsStore.getState()
    expect(after.byId.s1).not.toBe(before.byId.s1)
    expect(after.byId.s2).toBe(before.byId.s2)
    expect(after.recentIds).toBe(before.recentIds)
    expect(after.projectSessionIds).toBe(before.projectSessionIds)
    const nav = splitNavSections({ ...after, pinnedProjectIds: new Set(['p1']) })
    expect(nav.recent.map((item) => item.title)).toEqual(['changed'])
    expect(nav.projectChildren.p1.map((item) => item.title)).toEqual(['two'])
  })

  it('최근 응답의 순서를 따르고 GC는 프로젝트만 참조하는 행을 보존한다', async () => {
    sessionList.mockResolvedValue([session('old', 'old'), session('s1', 'one')])
    await initSessions()
    projectListSessions.mockResolvedValue([session('project-only', 'project', 'p1')])
    await sessionsActions.loadProject('p1')
    const projectOnly = useSessionsStore.getState().byId['project-only']
    sessionList.mockResolvedValue([session('s2', 'two'), session('s1', 'one')])
    await initSessions()
    expect(useSessionsStore.getState().recentIds).toEqual(['s2', 's1'])
    expect(useSessionsStore.getState().byId.old).toBeUndefined()
    expect(useSessionsStore.getState().byId['project-only']).toBe(projectOnly)
    sessionList.mockResolvedValue([])
    await initSessions()
    expect(useSessionsStore.getState().recentIds).toEqual([])
    expect(useSessionsStore.getState().byId).toEqual({ 'project-only': projectOnly })
  })

  it('GC의 프로젝트 우선 엔티티 순서는 같은 시각에 고정된 대화의 순서를 보존한다', async () => {
    const recent = { ...session('recent', 'recent'), pinnedAt: 1 }
    const project = { ...session('project', 'project', 'p1'), pinnedAt: 1 }
    sessionList.mockResolvedValue([recent, project])
    await initSessions()
    projectListSessions.mockResolvedValue([project])
    await sessionsActions.loadProject('p1')
    await initSessions()
    const state = useSessionsStore.getState()
    expect(
      splitNavSections({ ...state, pinnedProjectIds: new Set() }).pinned.map((s) => s.id)
    ).toEqual(['project', 'recent'])
    await initSessions()
    expect(useSessionsStore.getState()).toBe(state)
  })

  it('조회 실패는 reject하면서 최근 목록과 이미 조회한 프로젝트를 보존한다', async () => {
    sessionList.mockResolvedValue([session('s1', 'one')])
    projectListSessions.mockResolvedValue([session('s2', 'two', 'p1')])
    await initSessions()
    await sessionsActions.loadProject('p1')
    const before = useSessionsStore.getState()
    sessionList.mockRejectedValue(new Error('recent unavailable'))
    projectListSessions.mockRejectedValue(new Error('project unavailable'))
    await expect(initSessions()).rejects.toThrow('recent unavailable')
    await expect(sessionsActions.loadProject('p1')).rejects.toThrow('project unavailable')
    expect(useSessionsStore.getState().byId).toBe(before.byId)
    expect(useSessionsStore.getState().recentIds).toBe(before.recentIds)
    expect(useSessionsStore.getState().projectSessionIds).toBe(before.projectSessionIds)
    expect(useSessionsStore.getState().loading).toBe(false)
    expect(useSessionsStore.getState().projectSessionIds.p2).toBeUndefined()
    await expect(sessionsActions.loadProject('p2')).rejects.toThrow('project unavailable')
    expect(useSessionsStore.getState().projectSessionIds.p2).toEqual([])
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
