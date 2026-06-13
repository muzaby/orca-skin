import { useEffect, useRef } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { chatActions, getActiveChatSession, useChatSession } from '../../features/chat'
import { useSessionsState } from '../../features/sessions'

// URL ↔ chat store 의 양방향 동기화. AppLayout 레벨에서 한 번만 마운트해 두면
// chat 적합 라우트 세 가지(`/new`, `/chat/:sessionId`, `/projects/:projectId`)
// 에서 모든 라이프사이클을 받쳐준다.
//
// 방향 1 — URL → State
//   - `/new`                  : dirty (sessionId / pendingProjectId / messages) → newChat()
//   - `/chat/:sessionId`      : sessionId 가 url 과 다르면 loadSession(id, metaTitle)
//   - `/projects/:projectId`  : pendingProjectId 가 url 과 다르거나 sessionId 가 남아 있으면
//                               newChat(projectId). 단, messages.length 는 검사하지 않음 —
//                               사용자가 랜딩에서 입력 중일 때 wipe 되지 않도록.
//   상태는 effect 안에서 getState() 로 *imperative* 하게 읽는다 — 상태 변화(첫 전송 등)가
//   이 effect 를 재실행해 대화를 wipe 하지 않도록 트리거는 URL/sessions 변화로 한정.
//
// 방향 2 — State → URL (armed-ref 로 stale state race 차단)
//   - `/new` 또는 `/projects/:projectId` 에서 sessionId 가 null 인 상태를 한 번
//     본 뒤(=arm), 이어서 null → non-null 로 바뀌면 한 번만 `/chat/<id>` replace.
//   - 라우트 전이 직후의 stale sessionId 는 armed=false 라서 navigate 되지 않음.
//
// AppLayout 은 Routes 위에 있으므로 `useParams` 가 비어 있다 — `matchPath` 로 직접
// 추출. cross-feature wiring(chat + sessions) 이라 셸이 호스트.
export function useChatRouteSync(): void {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const sessions = useSessionsState((s) => s.list)

  const onNew = pathname === '/new'
  const chatMatch = matchPath('/chat/:sessionId', pathname)
  const projectMatch = matchPath('/projects/:projectId', pathname)
  const urlSessionId = chatMatch?.params.sessionId ?? null
  const urlProjectId = projectMatch?.params.projectId ?? null

  // 방향 1 — URL → State (URL/sessions 변화만 트리거, 상태는 imperative read)
  useEffect(() => {
    const cur = getActiveChatSession()
    if (onNew) {
      // `/new` 는 깨끗한 새 대화. 직전에 프로젝트 랜딩에서 `pendingProjectId` 가
      // 묶여 있던 경우도 함께 해제한다.
      const dirty = cur.sessionId != null || cur.pendingProjectId != null || cur.messages.length > 0
      if (dirty) chatActions.newChat()
      return
    }
    if (urlSessionId != null) {
      if (cur.sessionId === urlSessionId && !cur.loadingSession) return
      const meta = sessions.find((s) => s.id === urlSessionId)
      const metaTitle = meta?.title?.trim() || meta?.preview?.trim() || null
      void chatActions.loadSession(urlSessionId, metaTitle)
      return
    }
    if (urlProjectId != null) {
      // 프로젝트 랜딩으로 진입 / 다른 프로젝트로 전이 시에만 reset. 이미 같은
      // 프로젝트에 묶여 있고(sessionId 도 없음) 사용자가 입력 중인 상태는 보존.
      const wrongState = cur.pendingProjectId !== urlProjectId || cur.sessionId != null
      if (wrongState) chatActions.newChat(urlProjectId)
      return
    }
    // chat 라우트(비채팅, 예: /projects, /agent 등) → no-op.
  }, [onNew, urlSessionId, urlProjectId, sessions])

  // 방향 2 — State → URL (armed-ref)
  const sessionId = useChatSession((s) => s.sessionId)
  const armedRef = useRef(false)
  useEffect(() => {
    const upgradable = onNew || urlProjectId != null
    if (!upgradable) {
      armedRef.current = false
      return
    }
    if (sessionId == null) {
      // newChat 적용된 뒤 — 다음 sessionId 발급을 기다리는 상태.
      armedRef.current = true
      return
    }
    if (armedRef.current) {
      // null → non-null 전이를 한 번만 발사.
      armedRef.current = false
      navigate(`/chat/${sessionId}`, { replace: true })
    }
  }, [onNew, urlProjectId, sessionId, navigate])
}
