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

async function refresh(): Promise<void> {
  const items = await sessionApi.list()
  setState({ list: items, loading: false })
}

async function remove(sessionId: string): Promise<void> {
  await sessionApi.delete(sessionId)
  await refresh()
}

async function rename(sessionId: string, title: string): Promise<void> {
  await sessionApi.rename(sessionId, title)
  await refresh()
}

export const sessionsActions = { refresh, remove, rename }

// 부팅 1회 조회 + 자동 제목 이벤트 구독(행 in-place 패치 — 전체 refresh 없이).
export function bootstrapSessions(): () => void {
  let alive = true
  sessionApi
    .list()
    .then((items) => {
      if (alive) setState({ list: items, loading: false })
    })
    .catch(() => {
      if (alive) setState({ loading: false })
    })
  const unsubscribeTitle = sessionApi.onTitle((ev) => {
    setState((s) => ({
      list: s.list.map((item) => (item.id === ev.sessionId ? { ...item, title: ev.title } : item))
    }))
  })
  return () => {
    alive = false
    unsubscribeTitle()
  }
}

export function useSessionsState<T>(selector: (s: SessionsStoreState) => T): T {
  return useSessionsStore(selector)
}
