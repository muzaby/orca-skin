// Zustand sessions store — 구 SessionsProvider(Context)의 전환(handoff 0013).
// 사이드바 "최근 대화" 메타 목록. main 의 sessions 테이블이 SSOT — 부팅 1회 조회 +
// 외부 트리거(턴 완료·삭제·rename)의 refresh 로 동기화.

import { create } from 'zustand'
import type { SessionListItem } from '../../../../../shared/ipc'
import { projectApi, sessionApi } from '../../../shared/api/ipc'

interface SessionsStoreState {
  // 세션 엔티티의 renderer 단일 정본. recent/project 조회는 ID membership 만 따로 가진다.
  byId: Record<string, SessionListItem>
  recentIds: string[]
  projectSessionIds: Record<string, string[]>
  projectLoading: Record<string, boolean>
  loading: boolean
}

export const useSessionsStore = create<SessionsStoreState>()(() => ({
  byId: {},
  recentIds: [],
  projectSessionIds: {},
  projectLoading: {},
  loading: true
}))

const { setState } = useSessionsStore

function mergeItems(
  current: Record<string, SessionListItem>,
  items: SessionListItem[]
): Record<string, SessionListItem> {
  const next = { ...current }
  for (const item of items) next[item.id] = item
  return next
}

export async function initSessions(): Promise<void> {
  try {
    const items = await sessionApi.list()
    setState((state) => {
      const projectIds = new Set(Object.values(state.projectSessionIds).flat())
      const byId = Object.fromEntries(
        Object.entries(state.byId).filter(([id]) => projectIds.has(id))
      )
      const merged = mergeItems(byId, items)
      return {
        ...state,
        byId: merged,
        recentIds: items.map((item) => item.id),
        loading: false
      }
    })
  } catch (error) {
    setState({ loading: false })
    throw error
  }
}

async function remove(sessionId: string): Promise<void> {
  await sessionApi.delete(sessionId)
  setState((state) => {
    const byId = { ...state.byId }
    delete byId[sessionId]
    const projectSessionIds = Object.fromEntries(
      Object.entries(state.projectSessionIds).map(([id, ids]) => [
        id,
        ids.filter((candidate) => candidate !== sessionId)
      ])
    )
    return {
      ...state,
      byId,
      recentIds: state.recentIds.filter((candidate) => candidate !== sessionId),
      projectSessionIds
    }
  })
}

async function rename(sessionId: string, title: string): Promise<void> {
  await sessionApi.rename(sessionId, title)
  setState((state) => {
    const current = state.byId[sessionId]
    if (!current) return state
    const byId = { ...state.byId, [sessionId]: { ...current, title } }
    return { byId }
  })
}

// 0129 고정 토글 — main 이 pinned_at 을 시각/null 로 기록하고 공용 엔티티를 패치한다.
async function setPinned(sessionId: string, pinned: boolean): Promise<void> {
  await sessionApi.setPinned(sessionId, pinned)
  setState((state) => {
    const current = state.byId[sessionId]
    if (!current) return state
    const byId = {
      ...state.byId,
      [sessionId]: { ...current, pinnedAt: pinned ? Date.now() : null }
    }
    return { byId }
  })
}

async function loadProject(projectId: string): Promise<void> {
  setState((state) => ({
    projectLoading: { ...state.projectLoading, [projectId]: true }
  }))
  try {
    const items = await projectApi.listSessions(projectId)
    setState((state) => {
      const byId = mergeItems(state.byId, items)
      return {
        ...state,
        byId,
        projectSessionIds: {
          ...state.projectSessionIds,
          [projectId]: items.map((item) => item.id)
        },
        projectLoading: { ...state.projectLoading, [projectId]: false }
      }
    })
  } catch (error) {
    setState((state) => ({
      projectLoading: { ...state.projectLoading, [projectId]: false }
    }))
    throw error
  }
}

export const sessionsActions = { refresh: initSessions, loadProject, remove, rename, setPinned }

// 자동 제목 이벤트 구독(행 in-place 패치 — 전체 refresh 없이).
// 부팅 1회 조회는 initSessions(부트 오케스트레이터가 await), Provider 는 subscribeSessions 만 붙인다.
export function subscribeSessions(): () => void {
  return sessionApi.onTitle((ev) => {
    setState((state) => {
      const current = state.byId[ev.sessionId]
      if (!current) return state
      const byId = { ...state.byId, [ev.sessionId]: { ...current, title: ev.title } }
      return { byId }
    })
  })
}

export function useSessionsState<T>(selector: (s: SessionsStoreState) => T): T {
  return useSessionsStore(selector)
}
