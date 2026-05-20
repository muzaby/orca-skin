import { useCallback, useEffect, useState } from 'react'
import type { SessionListItem } from '../../../shared/ipc'

export interface UseSessions {
  list: SessionListItem[]
  loading: boolean
  refresh: () => Promise<void>
  remove: (sessionId: string) => Promise<void>
}

// 사이드바 "최근 대화" 목록을 위한 hook. 부팅 시 1회 조회하고, 새 메시지 / 새 대화
// 같은 외부 트리거에 의해 refresh 호출. main 의 sessions 테이블이 SSOT.
export function useSessions(): UseSessions {
  const [list, setList] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const items = await window.orca.session.list()
    setList(items)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    window.orca.session
      .list()
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
  }, [])

  const remove = useCallback(
    async (sessionId: string) => {
      await window.orca.session.delete(sessionId)
      await refresh()
    },
    [refresh]
  )

  return { list, loading, refresh, remove }
}
