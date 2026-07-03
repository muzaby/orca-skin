import { useCallback, useMemo } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import {
  chatActions,
  useActiveContinuityDraftKey,
  useContinuityDraftRows,
  type ContinuityDraftRow
} from '../../features/chat'
import { sessionsActions, type DraftSessionRow } from '../../features/sessions'
import { useProjectsState } from '../../features/projects'

export interface SessionHandlers {
  currentSessionId: string | null
  projectNameById: Map<string, string>
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
  // 0062 r4 — 미물질화 continuity draft(fork/handoff) nav 행. chat store 파생 값을
  // sessions feature 의 구조적 타입으로 매핑해 내린다(cross-feature 는 셸이 wiring).
  draftSessions: DraftSessionRow[]
  activeDraftKey: string | null
  handleSelectDraft: (key: string) => void
  handleDeleteDraft: (key: string) => void
}

// 사이드바 SessionList 가 필요로 하는 cross-feature 핸들러 합성. URL 변경을 통해
// 라우팅을 진실의 출처로 만든다 — 선택은 `navigate(\`/chat/<id>\`)`, 삭제 후 현재
// 활성 세션이면 `/new` 로 replace. 실제 세션 로드/리셋은 useChatRouteSync 가 URL
// 변화에서 흡수.
export function useSessionHandlers(): SessionHandlers {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const projects = useProjectsState((s) => s.list)
  const draftRows = useContinuityDraftRows()
  const activeDraftKey = useActiveContinuityDraftKey()

  // 사이드바 활성 세션의 진실은 URL — `/chat/:sessionId` 에 있을 때만 해당 행이 활성.
  // ChatContext.state.sessionId 는 캐시/IPC 용도로 다른 라우트에서도 유지되므로 UI
  // 활성 표시에는 부적합 (다른 라우트로 이동해도 활성 잔존 버그 원인).
  // continuity draft 가 활성이면 강조는 draft 행 몫 — URL(부모 세션) 행 강조를 끈다.
  const match = matchPath('/chat/:sessionId', pathname)
  const urlSessionId = match?.params.sessionId ?? null
  const currentSessionId = activeDraftKey != null ? null : urlSessionId

  // chat/sessions 액션은 모듈 상수라 본질적으로 안정 — deps/메모 무력화 걱정이 없다
  // (0007 의 "안정 함수만 뽑기" 패턴이 store 전환으로 기본값이 됨).
  const { handleSessionDeleted, renameSession } = chatActions
  const { remove: removeSession, rename: renameSessionMeta } = sessionsActions

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) map.set(p.id, p.name)
    return map
  }, [projects])

  const draftSessions = useMemo<DraftSessionRow[]>(
    () =>
      draftRows.map((d: ContinuityDraftRow) => ({
        key: d.key,
        title: d.title,
        projectId: d.projectId
      })),
    [draftRows]
  )

  const handleSelectSession = useCallback(
    (id: string): void => {
      // 메타 title 의 즉시 적용은 useChatRouteSync 가 sessions list 에서 직접 읽음.
      // 활성 draft 는 /chat/<부모> 위의 파생 뷰라, 부모 행 클릭 시 URL 이 안 바뀌어 라우트
      // 싱크가 못 깨어난다 — store 전환(loadSession)을 직접 수행해 draft 에서 빠져나온다.
      if (activeDraftKey != null) void chatActions.loadSession(id)
      navigate(`/chat/${id}`)
    },
    [navigate, activeDraftKey]
  )

  const handleDeleteSession = useCallback(
    (id: string): void => {
      const wasActive = urlSessionId === id
      handleSessionDeleted(id)
      void removeSession(id)
      if (wasActive) navigate('/new', { replace: true })
    },
    [urlSessionId, handleSessionDeleted, removeSession, navigate]
  )

  const handleRenameSession = useCallback(
    (id: string, title: string): void => {
      void renameSession(id, title)
      void renameSessionMeta(id, title)
    },
    [renameSession, renameSessionMeta]
  )

  // draft 행 클릭 — 활성화 후 /chat/<부모> 로 이동해 라우트 싱크의 draft 가드(소스-URL
  // 한정)와 정합을 맞춘다(이미 그 URL 이면 navigate 는 no-op).
  const handleSelectDraft = useCallback(
    (key: string): void => {
      const parent = chatActions.activateContinuityDraft(key)
      if (parent) navigate(`/chat/${parent}`)
    },
    [navigate]
  )

  // draft 행 삭제 — 메모리 전용 폐기(영속 흔적 0). 활성 draft 였다면 store 가 부모 세션
  // 엔트리로 복귀한다(URL 은 이미 /chat/<부모>).
  const handleDeleteDraft = useCallback((key: string): void => {
    chatActions.discardContinuityDraft(key)
  }, [])

  return {
    currentSessionId,
    projectNameById,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    draftSessions,
    activeDraftKey,
    handleSelectDraft,
    handleDeleteDraft
  }
}
