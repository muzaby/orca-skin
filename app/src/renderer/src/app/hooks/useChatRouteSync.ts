import { useEffect, useRef } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import { chatActions, getActiveChatSession, useChatSession } from '../../features/chat'
import { useSessionsState } from '../../features/sessions'
import { useProjectsState } from '../../features/projects'

// URL ↔ chat store 의 양방향 동기화. AppLayout 레벨에서 한 번만 마운트해 두면
// chat 적합 라우트 세 가지(`/new`, `/chat/:sessionId`, `/projects/:projectId`)
// 에서 모든 라이프사이클을 받쳐준다.
//
// 방향 1 — URL → State
//   - `/new`                  : dirty (sessionId / pendingProjectId / messages) → newChat()
//   - `/chat/:sessionId`      : sessionId 가 url 과 다르면 loadSession(id, metaTitle)
//   - `/projects/:projectId`  : 실제 경로 진입 때만 상태를 맞추고 newChat(projectId).
//                               같은 경로의 카탈로그 갱신은 지각 cwd 초기화만 시도한다.
//   상태는 effect 안에서 getState() 로 *imperative* 하게 읽는다 — 상태 변화(첫 전송 등)가
//   이 effect 를 재실행해 대화를 wipe 하지 않도록 트리거는 URL/sessions 변화로 한정.
//
// 방향 2 — State → URL (경로에 묶인 armed-ref 로 stale state race 차단)
//   - `/new` 또는 `/projects/:projectId` 에서 sessionId 가 null 인 상태를 한 번
//     본 뒤(=arm), 이어서 null → non-null 로 바뀌면 한 번만 `/chat/<id>` replace.
//   - URL → State 적용 후의 실제 활성 세션을 다시 읽고, 같은 경로에서만 승격한다.
//
// AppLayout 은 Routes 위에 있으므로 `useParams` 가 비어 있다 — `matchPath` 로 직접
// 추출. cross-feature wiring(chat + sessions) 이라 셸이 호스트.
export function useChatRouteSync(): void {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const onNew = pathname === '/new'
  const chatMatch = matchPath('/chat/:sessionId', pathname)
  const projectMatch = matchPath('/projects/:projectId', pathname)
  const urlSessionId = chatMatch?.params.sessionId ?? null
  const urlProjectId = projectMatch?.params.projectId ?? null
  const urlProject = useProjectsState((state) =>
    state.list.find((project) => project.id === urlProjectId)
  )
  // URL 이 가리키는 세션 하나만 구독한다 — byId 맵 전체를 구독하면 무관한 세션의 제목
  // 이벤트·고정 토글까지 이 effect 를 다시 돌린다(엔티티 참조는 store 가 보존).
  const urlSessionMeta = useSessionsState((state) =>
    urlSessionId != null ? state.byId[urlSessionId] : undefined
  )

  // 방향 1 — URL → State (URL/sessions 변화만 트리거, 상태는 imperative read)
  //
  // 랜딩 리셋은 실제 경로 진입일 때만 수행한다. 확정 직후의 카탈로그 재조회도 이 effect를
  // 깨우므로 같은 경로에서 sessionId가 생겼다는 이유로 reset하면 방금 보낸 본문이 사라진다.
  const prevPathnameRef = useRef<string | null>(null)
  const armedRef = useRef<string | null>(null)
  useEffect(() => {
    const entered = prevPathnameRef.current !== pathname
    prevPathnameRef.current = pathname
    const cur = getActiveChatSession()
    if (onNew) {
      // `/new` 는 깨끗한 새 대화. 직전에 프로젝트 랜딩에서 `pendingProjectId` 가
      // 묶여 있던 경우도 함께 해제한다. 단 `/new` 로 진입한 순간에만 — 머무는 중의
      // sessions 갱신/승격 재실행에서는 wipe 하지 않는다.
      const dirty = cur.sessionId != null || cur.pendingProjectId != null || cur.messages.length > 0
      if (entered && dirty) chatActions.newChat()
      return
    }
    if (urlSessionId != null) {
      if (cur.sessionId === urlSessionId && !cur.loadingSession) return
      // 0064 continuity — /chat/<원본> URL 에 머문 채 fork/handoff draft 가 활성인 상태.
      // **URL 이 draft 의 소스 세션을 가리킬 때만** 재로드를 막는다(승격 시 방향 2 가
      // /chat/<새 id> 로 이동). 다른 세션으로의 이동(urlSessionId ≠ 소스)은 정상 로드 —
      // r1 의 무조건 가드가 사이드바 세션 전환까지 차단하던 버그 수정(r2).
      if (
        urlSessionId === (cur.forkFrom ?? cur.handoffFrom) &&
        (cur.sessionId == null || armedRef.current === pathname)
      )
        return
      const metaTitle = urlSessionMeta?.title?.trim() || urlSessionMeta?.preview?.trim() || null
      void chatActions.loadSession(urlSessionId, metaTitle)
      return
    }
    if (urlProjectId != null) {
      // 프로젝트 랜딩으로 진입 / 다른 프로젝트로 전이 시에만 reset. 이미 같은
      // 프로젝트에 묶여 있고(sessionId 도 없음) 사용자가 입력 중인 상태는 보존.
      const wrongState = cur.pendingProjectId !== urlProjectId || cur.sessionId != null
      if (entered && wrongState) chatActions.newChat(urlProjectId, urlProject?.cwd)
      if (urlProject) chatActions.initializeProjectCwd(urlProjectId, urlProject.cwd)
      return
    }
    // chat 라우트(비채팅, 예: /projects, /agent 등) → no-op.
  }, [onNew, urlSessionId, urlProjectId, urlSessionMeta, urlProject, pathname])

  // 방향 2 — State → URL (armed-ref)
  const sessionId = useChatSession((s) => s.sessionId)
  // 0064 continuity — fork/handoff 파생 뷰 마커. draft(sessionId=null)에서 arm 되고 SDK
  // 새 id 승격(null → non-null) 시 /chat/<새 id> 로 이동한다(/chat/<원본> 경로에서도).
  // 마커는 승격 후에도 state 에 남아 이 effect 의 upgradable 이 전이 프레임까지 유지된다.
  const continuityMarker = useChatSession((s) => s.forkFrom != null || s.handoffFrom != null)
  useEffect(() => {
    // 앞 effect가 새 landing이나 다른 대화로 전환했을 수 있다. render 시 캡처한 이전
    // 세션으로 이동하지 않으며 continuity도 실제 원본 URL에 머물러 있을 때만 승격한다.
    const cur = getActiveChatSession()
    const upgradable =
      onNew ||
      urlProjectId != null ||
      (urlSessionId != null && urlSessionId === (cur.forkFrom ?? cur.handoffFrom))
    if (!upgradable) {
      armedRef.current = null
      return
    }
    if (cur.sessionId == null) {
      // newChat 적용된 뒤 — 다음 sessionId 발급을 기다리는 상태.
      armedRef.current = pathname
      return
    }
    // render 이후 다른 활성 상태가 들어왔다면 다음 render의 일치한 snapshot을 기다린다.
    if (cur.sessionId !== sessionId) return
    if (armedRef.current === pathname) {
      // null → non-null 전이를 한 번만 발사.
      armedRef.current = null
      navigate(`/chat/${sessionId}`, { replace: true })
    }
  }, [onNew, urlProjectId, urlSessionId, continuityMarker, sessionId, navigate, pathname])
}
