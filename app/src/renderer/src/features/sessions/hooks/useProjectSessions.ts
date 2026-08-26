import { useEffect, useMemo } from 'react'
import type { SessionListItem } from '../../../../../shared/ipc'
import { sessionsActions, useSessionsState } from '../store/sessionsStore'

export interface UseProjectSessions {
  list: SessionListItem[]
  loading: boolean
}

// 프로젝트 조회는 membership(ID 순서)만 추가하고 세션 엔티티는 sessionsStore 한 곳에서
// 소유한다. 따라서 이름·pin·삭제 mutation 은 프로젝트/고정/최근 뷰에 동시에 반영된다.
// 마운트마다 재검증하되, membership 이 이미 있으면 목록을 계속 보여 준다(로딩 깜빡임 없음).
export function useProjectSessions(projectId: string): UseProjectSessions {
  const byId = useSessionsState((state) => state.byId)
  const ids = useSessionsState((state) => state.projectSessionIds[projectId])
  const list = useMemo(() => (ids ?? []).flatMap((id) => (byId[id] ? [byId[id]] : [])), [byId, ids])

  useEffect(() => {
    void sessionsActions.loadProject(projectId).catch(() => undefined)
  }, [projectId])

  return { list, loading: ids == null }
}
