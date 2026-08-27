import { useMemo, type ReactNode } from 'react'
import { PinnedProjectsSection, PinnedSection, SessionList } from '../../features/sessions'
import { SidebarUserButton } from '../SidebarUserButton'
import type { SessionHandlers } from './useSessionHandlers'

export interface SidebarSlots {
  projectsSlot: ReactNode
  pinnedSlot: ReactNode
  sessionsSlot: ReactNode
  footerSlot: ReactNode
}

// Sidebar 의 React.memo() 가 효과를 내려면 slot ReactNode 들이 referentially stable
// 해야 한다. AppLayout 이 chat.state.inflight 토글 등으로 리렌더돼도 slot identity 가
// 유지되어 Sidebar 가 skip 된다.
export function useSidebarSlots(handlers: SessionHandlers): SidebarSlots {
  // footer = 사용자 버튼(이메일/developer + 팝오버 메뉴 + 설정 모달). 안정 identity 로
  // 두어 Sidebar memo 를 유지한다(자체 상태는 컴포넌트 내부 useState 로 격리).
  const footerSlot = useMemo(() => <SidebarUserButton />, [])
  const projectsSlot = useMemo(
    () => (
      <PinnedProjectsSection
        pinnedProjects={handlers.pinnedProjects}
        pinnedProjectIds={handlers.pinnedProjectIds}
        currentSessionId={handlers.currentSessionId}
        onOpenProject={handlers.handleOpenProject}
        onTogglePinProject={handlers.handleTogglePinProject}
        onSelectSession={handlers.handleSelectSession}
        onTogglePinSession={handlers.handleTogglePinSession}
        onDeleteSession={handlers.handleDeleteSession}
        onRenameSession={handlers.handleRenameSession}
      />
    ),
    [
      handlers.pinnedProjects,
      handlers.pinnedProjectIds,
      handlers.currentSessionId,
      handlers.handleOpenProject,
      handlers.handleTogglePinProject,
      handlers.handleSelectSession,
      handlers.handleTogglePinSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession
    ]
  )
  // 고정된 대화만 모으는 섹션. 프로젝트는 바로 위의 전용 섹션에만 노출한다.
  const pinnedSlot = useMemo(
    () => (
      <PinnedSection
        pinnedProjectIds={handlers.pinnedProjectIds}
        currentSessionId={handlers.currentSessionId}
        onSelectSession={handlers.handleSelectSession}
        onTogglePinSession={handlers.handleTogglePinSession}
        onDeleteSession={handlers.handleDeleteSession}
        onRenameSession={handlers.handleRenameSession}
      />
    ),
    [
      handlers.pinnedProjectIds,
      handlers.currentSessionId,
      handlers.handleSelectSession,
      handlers.handleTogglePinSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession
    ]
  )
  const sessionsSlot = useMemo(
    () => (
      <SessionList
        currentSessionId={handlers.currentSessionId}
        projectNameById={handlers.projectNameById}
        pinnedProjectIds={handlers.pinnedProjectIds}
        onSelect={handlers.handleSelectSession}
        onDelete={handlers.handleDeleteSession}
        onRename={handlers.handleRenameSession}
        onTogglePin={handlers.handleTogglePinSession}
        drafts={handlers.draftSessions}
        activeDraftKey={handlers.activeDraftKey}
        onSelectDraft={handlers.handleSelectDraft}
        onDeleteDraft={handlers.handleDeleteDraft}
      />
    ),
    [
      handlers.currentSessionId,
      handlers.projectNameById,
      handlers.pinnedProjectIds,
      handlers.handleSelectSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession,
      handlers.handleTogglePinSession,
      handlers.draftSessions,
      handlers.activeDraftKey,
      handlers.handleSelectDraft,
      handlers.handleDeleteDraft
    ]
  )
  return { projectsSlot, pinnedSlot, sessionsSlot, footerSlot }
}
