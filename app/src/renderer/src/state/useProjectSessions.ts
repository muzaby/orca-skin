import { useCallback, useEffect, useState } from 'react'
import type { SessionListItem } from '../../../shared/ipc'

export interface UseProjectSessions {
  list: SessionListItem[]
  loading: boolean
  refresh: () => Promise<void>
}

// 특정 프로젝트에 소속된 세션 목록. projectId 변경 시 자동 refetch.
// 사이드바 "최근 대화"(useSessions) 와는 별도 — 그쪽은 전체 세션을 노출한다.
// 호출자는 projectId 가 항상 truthy 임을 보장한다 (ProjectDetail 만 사용).
export function useProjectSessions(projectId: string): UseProjectSessions {
  const [list, setList] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const items = await window.orca.project.listSessions(projectId)
    setList(items)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    window.orca.project
      .listSessions(projectId)
      .then((items) => {
        if (cancelled) return
        setList(items)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  return { list, loading, refresh }
}
