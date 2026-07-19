// Zustand sessions store — 구 SessionsProvider(Context)의 전환(handoff 0013).
// 사이드바 "최근 대화" 메타 목록. main 의 sessions 테이블이 SSOT — 부팅 1회 조회 +
// 외부 트리거(턴 완료·삭제·rename)의 refresh 로 동기화.

import { create } from 'zustand'
import type { SessionListItem } from '../../../../../shared/ipc'
import { sessionApi } from '../../../shared/api/ipc'

interface SessionsStoreState {
  list: SessionListItem[]
  loading: boolean
}

export const useSessionsStore = create<SessionsStoreState>()(() => ({
  list: [],
  loading: true
}))

const { setState } = useSessionsStore

export async function initSessions(): Promise<void> {
  try {
    const items = await sessionApi.list()
    setState({ list: items, loading: false })
  } catch (error) {
    setState({ loading: false })
    throw error
  }
}

async function remove(sessionId: string): Promise<void> {
  await sessionApi.delete(sessionId)
  await initSessions()
}

async function rename(sessionId: string, title: string): Promise<void> {
  await sessionApi.rename(sessionId, title)
  await initSessions()
}

// 0129 고정 토글 — main 이 pinned_at 을 시각/null 로 기록. 이후 refresh 로 목록 갱신.
async function setPinned(sessionId: string, pinned: boolean): Promise<void> {
  await sessionApi.setPinned(sessionId, pinned)
  await initSessions()
}

export const sessionsActions = { refresh: initSessions, remove, rename, setPinned }

// 자동 제목 이벤트 구독(행 in-place 패치 — 전체 refresh 없이).
// 부팅 1회 조회는 initSessions(부트 오케스트레이터가 await), Provider 는 subscribeSessions 만 붙인다.
export function subscribeSessions(): () => void {
  return sessionApi.onTitle((ev) => {
    setState((s) => ({
      list: s.list.map((item) => (item.id === ev.sessionId ? { ...item, title: ev.title } : item))
    }))
  })
}

export function useSessionsState<T>(selector: (s: SessionsStoreState) => T): T {
  return useSessionsStore(selector)
}
