import { useCallback, useEffect, useState } from 'react'
import type { SessionListItem } from '../../../../../shared/ipc'
import { projectApi, sessionApi } from '../../../shared/api/ipc'

export interface UseProjectSessions {
  list: SessionListItem[]
  loading: boolean
  refresh: () => Promise<void>
  remove: (sessionId: string) => Promise<void>
  rename: (sessionId: string, title: string) => Promise<void>
}

// 특정 프로젝트에 소속된 세션 목록. projectId 변경 시 자동 refetch.
// 사이드바 "최근 대화"(useSessions) 와는 별도 — 그쪽은 전체 세션을 노출한다.
// 호출자는 projectId 가 항상 truthy 임을 보장한다 (ProjectDetail 만 사용).
export function useProjectSessions(projectId: string): UseProjectSessions {
  const [list, setList] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const items = await projectApi.listSessions(projectId)
    setList(items)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    projectApi
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

  const remove = useCallback(
    async (sessionId: string) => {
      await sessionApi.delete(sessionId)
      await refresh()
    },
    [refresh]
  )

  const rename = useCallback(
    async (sessionId: string, title: string) => {
      await sessionApi.rename(sessionId, title)
      await refresh()
    },
    [refresh]
  )

  return { list, loading, refresh, remove, rename }
}
