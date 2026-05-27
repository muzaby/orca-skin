import { useEffect } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { useChatContext } from '../../features/chat'
import { useSessionsContext } from '../../features/sessions'

// URL ↔ ChatState 의 양방향 동기화. AppLayout 레벨에서 한 번만 마운트해 두면
// 다음을 받쳐준다.
//
// 방향 1) URL → State (네비게이션 반영)
//   - `/new`            && state.sessionId != null → newChat()
//   - `/chat/<id>`      && state.sessionId != <id> → loadSession(id, metaTitle)
//   - chat 라우트가 아닐 때 → no-op (프로젝트 랜딩에서는 자체 라이프사이클 관리)
//
// 방향 2) State → URL (첫 턴 완료로 sessionId 가 채워지면 URL 을 upgrade)
//   - `/new` && state.sessionId != null → replace(`/chat/<id>`)
//   - replace 가 핵심: history push 시 뒤로가기로 `/new` 에 빠짐 → 깜빡임.
//
// AppLayout 은 Routes 위에 있으므로 `useParams` 가 비어 있다 — `matchPath` 로 직접
// sessionId 를 추출한다. cross-feature wiring(chat + sessions) 이라 셸이 호스트.
export function useChatRouteSync(): void {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const chat = useChatContext()
  const { list: sessions } = useSessionsContext()

  const onNew = pathname === '/new'
  const chatMatch = matchPath('/chat/:sessionId', pathname)
  const urlSessionId = chatMatch?.params.sessionId ?? null
  const onChatRoute = onNew || urlSessionId != null

  // 방향 1 — URL → State
  useEffect(() => {
    if (!onChatRoute) return
    if (onNew) {
      // `/new` 는 깨끗한 새 대화. 직전에 프로젝트 랜딩에서 `pendingProjectId` 가
      // 묶여 있던 경우도 함께 해제한다.
      const dirty =
        chat.state.sessionId != null ||
        chat.state.pendingProjectId != null ||
        chat.state.messages.length > 0
      if (dirty) chat.newChat()
      return
    }
    if (urlSessionId == null) return
    if (chat.state.sessionId === urlSessionId && !chat.state.loadingSession) return
    const meta = sessions.find((s) => s.id === urlSessionId)
    const metaTitle = meta?.title?.trim() || meta?.preview?.trim() || null
    void chat.loadSession(urlSessionId, metaTitle)
    // chat 객체는 매 렌더 새 wrapper 를 받을 수 있어 deps 에 넣지 않는다.
    // URL(`onNew`/`urlSessionId`) 변화와 sessions list 변화만 동기화 트리거.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNew, urlSessionId, onChatRoute, sessions])

  // 방향 2 — State → URL (sessionId 신규 발급 시 `/new` → `/chat/<id>` upgrade)
  useEffect(() => {
    if (onNew && chat.state.sessionId) {
      navigate(`/chat/${chat.state.sessionId}`, { replace: true })
    }
  }, [onNew, chat.state.sessionId, navigate])
}
