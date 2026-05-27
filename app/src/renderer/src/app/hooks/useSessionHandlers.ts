import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatContext } from '../../features/chat'
import { useSessionsContext } from '../../features/sessions'
import { useProjectsContext } from '../../features/projects'

export interface SessionHandlers {
  currentSessionId: string | null
  projectNameById: Map<string, string>
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
}

// 사이드바 SessionList 가 필요로 하는 cross-feature 핸들러 합성. URL 변경을 통해
// 라우팅을 진실의 출처로 만든다 — 선택은 `navigate(\`/chat/<id>\`)`, 삭제 후 현재
// 활성 세션이면 `/new` 로 replace. 실제 세션 로드/리셋은 useChatRouteSync 가 URL
// 변화에서 흡수.
export function useSessionHandlers(): SessionHandlers {
  const navigate = useNavigate()
  const chat = useChatContext()
  const sessionsCtx = useSessionsContext()
  const { list: projects } = useProjectsContext()

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.name)
    return map
  }, [projects])

  const handleSelectSession = useCallback(
    (id: string): void => {
      // 메타 title 의 즉시 적용은 useChatRouteSync 가 sessions list 에서 직접 읽음.
      navigate(`/chat/${id}`)
    },
    [navigate]
  )

  const handleDeleteSession = useCallback(
    (id: string): void => {
      const wasActive = chat.state.sessionId === id
      chat.handleSessionDeleted(id)
      void sessionsCtx.remove(id)
      if (wasActive) navigate('/new', { replace: true })
    },
    [chat, sessionsCtx, navigate]
  )

  const handleRenameSession = useCallback(
    (id: string, title: string): void => {
      void chat.renameSession(id, title)
      void sessionsCtx.rename(id, title)
    },
    [chat, sessionsCtx]
  )

  return {
    currentSessionId: chat.state.sessionId,
    projectNameById,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession
  }
}
