import { useCallback, useMemo } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import {
  chatActions,
  useActiveDraftKey,
  useDraftSessionRows,
  type DraftRow
} from '../../features/chat'
import { pinnedProjectsOf, sessionsActions, type DraftSessionRow } from '../../features/sessions'
import { projectsActions, useProjectsState } from '../../features/projects'
import type { Project } from '../../../../shared/ipc'

export interface SessionHandlers {
  currentSessionId: string | null
  projectNameById: Map<string, string>
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
  // 0129 고정 — "고정됨" 섹션 데이터·토글. app 셸이 sessions/projects 두 feature 를 잇는다.
  pinnedProjects: Project[]
  // 최근 대화의 배치 판정에 쓰는 고정 프로젝트 id 집합 — pinnedProjects 와 같은 곳에서 파생한다.
  pinnedProjectIds: ReadonlySet<string>
  handleTogglePinSession: (id: string, pinned: boolean) => void
  handleTogglePinProject: (id: string, pinned: boolean) => void
  handleOpenProject: (id: string) => void
  // 0064 r4 / 0065 — 미물질화 draft(fork/handoff + 활성 '새 대화') nav 행. chat store 파생
  // 값을 sessions feature 의 구조적 타입으로 매핑해 내린다(cross-feature 는 셸이 wiring).
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
  const draftRows = useDraftSessionRows()
  const activeDraftKey = useActiveDraftKey()
  // 활성 draft 가 continuity(부모 有)인지 — '새 대화' 슬롯(부모 無)은 일반 라우팅으로 충분해
  // 부모-URL 우회(loadSession 직접 전환)를 태우지 않는다.
  const continuityDraftActive =
    activeDraftKey != null &&
    draftRows.some((d) => d.key === activeDraftKey && d.parentSessionId != null)

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

  // 고정 프로젝트 — 파생은 features/sessions 의 순수 함수가 갖는다(0203 ΔV1 EP-10).
  // hook 안에 두면 순수 테스트가 닿지 못한다.
  const pinnedProjects = useMemo(() => pinnedProjectsOf(projects), [projects])

  const pinnedProjectIds = useMemo(() => new Set(pinnedProjects.map((p) => p.id)), [pinnedProjects])

  const handleTogglePinSession = useCallback((id: string, pinned: boolean): void => {
    void sessionsActions.setPinned(id, pinned)
  }, [])

  const handleTogglePinProject = useCallback((id: string, pinned: boolean): void => {
    void projectsActions.setPinned(id, pinned)
  }, [])

  const handleOpenProject = useCallback(
    (id: string): void => {
      navigate(`/projects/${id}`)
    },
    [navigate]
  )

  const draftSessions = useMemo<DraftSessionRow[]>(
    () =>
      draftRows.map((d: DraftRow) => ({
        key: d.key,
        title: d.title,
        projectId: d.projectId,
        // '새 대화' 행(부모 無)은 활성일 때만 존재해 삭제 개념이 없다 — kebab 자체를 숨긴다.
        deletable: d.parentSessionId != null
      })),
    [draftRows]
  )

  const handleSelectSession = useCallback(
    (id: string): void => {
      // 메타 title 의 즉시 적용은 useChatRouteSync 가 sessions 엔티티에서 직접 읽음.
      // 활성 continuity draft 는 /chat/<부모> 위의 파생 뷰라, 부모 행 클릭 시 URL 이 안 바뀌어
      // 라우트 싱크가 못 깨어난다 — store 전환(loadSession)을 직접 수행해 draft 에서 빠져나온다.
      if (continuityDraftActive) void chatActions.loadSession(id)
      navigate(`/chat/${id}`)
    },
    [navigate, continuityDraftActive]
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
    pinnedProjects,
    pinnedProjectIds,
    handleTogglePinSession,
    handleTogglePinProject,
    handleOpenProject,
    draftSessions,
    activeDraftKey,
    handleSelectDraft,
    handleDeleteDraft
  }
}
