import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { settingsApi } from '../shared/api/ipc'

// `/` 라우트의 element. 부팅 직후 1회 settings IPC 를 조회해
// `lastSessionId` 가 있으면 `/chat/<id>` 로, 없으면 `/new` 로 replace.
// 이후 `/` 는 URL 에 등장하지 않으며, 세션 복원은 URL → State 동기화
// (useChatRouteSync) 가 일반 경로로 흡수한다.
export function BootRedirector(): React.JSX.Element | null {
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void settingsApi.get().then((s) => {
      if (cancelled) return
      setTarget(s.lastSessionId ? `/chat/${s.lastSessionId}` : '/new')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (target == null) return null
  return <Navigate to={target} replace />
}
