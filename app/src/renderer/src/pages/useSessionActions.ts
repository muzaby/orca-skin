import { useNavigate } from 'react-router-dom'
import { chatActions, useChatSession } from '../features/chat'
import { sessionsActions, useSessionsState } from '../features/sessions'

interface SessionActionsOptions {
  // 삭제 시 chat store 에 넘길 fallback projectId(프로젝트 랜딩에서만 지정).
  deleteFallbackProjectId?: string | null
  // 활성 세션을 삭제했을 때 이동할 경로(ChatPage='/new', 프로젝트='/projects/:id').
  redirectAfterActiveDelete: string
}

interface SessionActions {
  onOpenProject: (projectId: string) => void
  onDeleteSession: (sessionId: string) => void
  onRenameSession: (sessionId: string, title: string) => void
  // 0129 고정 — 현재(활성) 세션의 고정 상태 + 토글. ChatTitleBar 상단 컨트롤/메뉴가 소비.
  sessionPinned: boolean
  onTogglePinSession: (sessionId: string, pinned: boolean) => void
}

// 세션 삭제/이름변경의 2-스토어(chat + sessions) 동기화와 삭제 후 라우팅을 한 곳에 모은다.
// ChatPage·ProjectLandingPage 가 redirect 경로와 삭제 fallback projectId 만 달리해 공유한다
// (cross-feature 조합이라 feature 가 아닌 page 계층에 둔다).
export function useSessionActions({
  deleteFallbackProjectId,
  redirectAfterActiveDelete
}: SessionActionsOptions): SessionActions {
  const navigate = useNavigate()
  const activeSessionId = useChatSession((s) => s.sessionId)
  // 활성 세션의 고정 상태 — sessions 엔티티(SSOT)에서 파생. 토글은 store 를 제자리 패치한다.
  const sessionPinned = useSessionsState(
    (state) => activeSessionId != null && state.byId[activeSessionId]?.pinnedAt != null
  )

  return {
    onOpenProject: (projectId) => navigate(`/projects/${projectId}`),
    onDeleteSession: (id) => {
      const wasActive = activeSessionId === id
      void sessionsActions.remove(id).then((removed) => {
        if (!removed) return
        chatActions.handleSessionDeleted(id, deleteFallbackProjectId)
        if (wasActive) navigate(redirectAfterActiveDelete, { replace: true })
      })
    },
    onRenameSession: (id, title) => {
      void chatActions.renameSession(id, title)
      void sessionsActions.rename(id, title)
    },
    sessionPinned,
    onTogglePinSession: (id, pinned) => {
      void sessionsActions.setPinned(id, pinned)
    }
  }
}
