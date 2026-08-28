// Zustand sessions store — 구 SessionsProvider(Context)의 전환(handoff 0013).
// renderer 의 세션 엔티티 단일 정본. main 의 sessions 테이블이 SSOT 이고, 여기서는
// 조회 결과를 엔티티 풀(byId)에 병합한 뒤 각 목록은 ID membership 만 따로 갖는다.
// 이름·고정·삭제는 전체 재조회 없이 엔티티를 제자리 패치해 모든 뷰에 동시에 반영된다.

import { create } from 'zustand'
import type { SessionListItem } from '../../../../../shared/ipc'
import { projectApi, sessionApi } from '../../../shared/api/ipc'

interface SessionsStoreState {
  // 세션 엔티티의 renderer 단일 정본. recent/project 조회는 ID membership 만 따로 가진다.
  byId: Record<string, SessionListItem>
  recentIds: string[]
  // 값이 없으면 "아직 조회 안 함" — 로딩 판정이 이 한 축에서 나온다(별도 플래그 없음).
  projectSessionIds: Record<string, string[]>
  loading: boolean
}

export const useSessionsStore = create<SessionsStoreState>()(() => ({
  byId: {},
  recentIds: [],
  projectSessionIds: {},
  loading: true
}))

const { setState } = useSessionsStore

function sameItem(a: SessionListItem, b: SessionListItem): boolean {
  const keys = Object.keys(a) as (keyof SessionListItem)[]
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

// 재조회가 같은 내용을 돌려주면 byId 참조를 그대로 돌려준다 — 매번 새 객체를 만들면
// 프로젝트 하나를 펼칠 때마다 사이드바 전체가 리렌더된다.
function mergeItems(
  current: Record<string, SessionListItem>,
  items: SessionListItem[]
): Record<string, SessionListItem> {
  const next = { ...current }
  let changed = false
  for (const item of items) {
    const prev = next[item.id]
    if (prev && sameItem(prev, item)) continue
    next[item.id] = item
    changed = true
  }
  return changed ? next : current
}

function sameIds(a: string[] | undefined, b: string[]): boolean {
  return a != null && a.length === b.length && a.every((id, i) => id === b[i])
}

// 엔티티 한 건의 필드 패치 — 없는 id 는 no-op. rename/pin/제목 이벤트가 공유한다
// (chatStore 의 patchLive 와 같은 결). 비변경 행의 참조를 보존해 SessionRow memo 가 산다.
function patchSession(sessionId: string, patch: Partial<SessionListItem>): void {
  setState((state) => {
    const current = state.byId[sessionId]
    if (!current) return state
    return { byId: { ...state.byId, [sessionId]: { ...current, ...patch } } }
  })
}

export async function initSessions(): Promise<void> {
  try {
    const items = await sessionApi.list()
    setState((state) => {
      // GC 루트 = 새 recents ∪ 모든 projectSessionIds 버킷. listSessions 에는 LIMIT 이
      // 걸려 있어 최근 창 밖으로 밀려난 엔티티가 byId 에 남는다 — 어떤 membership 도
      // 참조하지 않는 것만 버린다. **새 membership 목록을 추가하면 여기 루트에도
      // 넣어야 한다** (안 넣으면 턴 종료마다 도는 이 refresh 에 조용히 쓸려나간다).
      const retained: Record<string, SessionListItem> = {}
      for (const ids of Object.values(state.projectSessionIds)) {
        for (const id of ids) {
          const session = state.byId[id]
          if (session) retained[id] = session
        }
      }
      for (const item of items) retained[item.id] = item
      return {
        byId: retained,
        recentIds: items.map((item) => item.id),
        loading: false
      }
    })
  } catch (error) {
    setState({ loading: false })
    throw error
  }
}

async function remove(sessionId: string): Promise<boolean> {
  const result = await sessionApi.delete(sessionId)
  if (!result.ok) {
    window.alert(result.message)
    return false
  }
  setState((state) => {
    const byId = { ...state.byId }
    delete byId[sessionId]
    // 담고 있던 버킷만 새 배열로 — 전부 갈아치우면 무관한 프로젝트 뷰의 memo 까지 깨진다.
    const projectSessionIds = { ...state.projectSessionIds }
    let touchedProject = false
    for (const [projectId, ids] of Object.entries(projectSessionIds)) {
      if (!ids.includes(sessionId)) continue
      projectSessionIds[projectId] = ids.filter((candidate) => candidate !== sessionId)
      touchedProject = true
    }
    return {
      byId,
      recentIds: state.recentIds.filter((candidate) => candidate !== sessionId),
      projectSessionIds: touchedProject ? projectSessionIds : state.projectSessionIds
    }
  })
  return true
}

async function rename(sessionId: string, title: string): Promise<void> {
  await sessionApi.rename(sessionId, title)
  patchSession(sessionId, { title })
}

// 0129 고정 토글 — main 이 pinned_at 을 시각/null 로 기록하고 공용 엔티티를 패치한다.
async function setPinned(sessionId: string, pinned: boolean): Promise<void> {
  await sessionApi.setPinned(sessionId, pinned)
  patchSession(sessionId, { pinnedAt: pinned ? Date.now() : null })
}

// 프로젝트 소속 조회 — 엔티티는 공용 풀에 병합하고 membership(ID 순서)만 따로 기록한다.
// 이미 조회한 프로젝트를 다시 부르면 재검증만 하고(목록은 계속 보임) 내용이 같으면
// 참조를 보존해 아무도 리렌더되지 않는다.
async function loadProject(projectId: string): Promise<void> {
  try {
    const items = await projectApi.listSessions(projectId)
    setState((state) => {
      const ids = items.map((item) => item.id)
      const prev = state.projectSessionIds[projectId]
      return {
        byId: mergeItems(state.byId, items),
        projectSessionIds: sameIds(prev, ids)
          ? state.projectSessionIds
          : { ...state.projectSessionIds, [projectId]: ids }
      }
    })
  } catch (error) {
    // 첫 조회가 실패하면 빈 membership 으로 확정한다 — 안 그러면 "아직 조회 안 함" 상태가
    // 남아 로딩 표시가 영원히 걸린다. 이미 받아둔 목록이 있으면 그대로 둔다(재검증 실패).
    setState((state) =>
      state.projectSessionIds[projectId] == null
        ? { projectSessionIds: { ...state.projectSessionIds, [projectId]: [] } }
        : state
    )
    throw error
  }
}

export const sessionsActions = { refresh: initSessions, loadProject, remove, rename, setPinned }

// 자동 제목 이벤트 구독(행 in-place 패치 — 전체 refresh 없이).
// 부팅 1회 조회는 initSessions(부트 오케스트레이터가 await), Provider 는 subscribeSessions 만 붙인다.
export function subscribeSessions(): () => void {
  return sessionApi.onTitle((ev) => patchSession(ev.sessionId, { title: ev.title }))
}

export function useSessionsState<T>(selector: (s: SessionsStoreState) => T): T {
  return useSessionsStore(selector)
}
