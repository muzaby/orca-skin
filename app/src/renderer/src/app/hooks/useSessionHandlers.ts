import { useCallback, useMemo } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { chatActions } from '../../features/chat'
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
  const { pathname } = useLocation()
  const sessionsCtx = useSessionsContext()
  const { list: projects } = useProjectsContext()

  // 사이드바 활성 세션의 진실은 URL — `/chat/:sessionId` 에 있을 때만 해당 행이 활성.
  // ChatContext.state.sessionId 는 캐시/IPC 용도로 다른 라우트에서도 유지되므로 UI
  // 활성 표시에는 부적합 (다른 라우트로 이동해도 활성 잔존 버그 원인).
  const match = matchPath('/chat/:sessionId', pathname)
  const currentSessionId = match?.params.sessionId ?? null

  // chat 액션은 모듈 상수(chatActions)라 본질적으로 안정 — deps/메모 무력화 걱정이 없다
  // (0007 의 "안정 함수만 뽑기" 패턴이 store 전환으로 기본값이 됨). sessionsCtx 는 기존 유지.
  const { handleSessionDeleted, renameSession } = chatActions
  const { remove: removeSession, rename: renameSessionMeta } = sessionsCtx

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
      const wasActive = currentSessionId === id
      handleSessionDeleted(id)
      void removeSession(id)
      if (wasActive) navigate('/new', { replace: true })
    },
    [currentSessionId, handleSessionDeleted, removeSession, navigate]
  )

  const handleRenameSession = useCallback(
    (id: string, title: string): void => {
      void renameSession(id, title)
      void renameSessionMeta(id, title)
    },
    [renameSession, renameSessionMeta]
  )

  return {
    currentSessionId,
    projectNameById,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession
  }
}
