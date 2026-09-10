import { agentUiPolicy } from '../../features/chat/lib/agentPresentation'
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
        agentAppearance={agentUiPolicy}
        pinnedProjects={handlers.navProjects}
        pinnedProjectIds={handlers.navProjectIds}
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
      handlers.navProjects,
      handlers.navProjectIds,
      handlers.currentSessionId,
      handlers.handleOpenProject,
      handlers.handleTogglePinProject,
      handlers.handleSelectSession,
      handlers.handleTogglePinSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession
    ]
  )
  // 프로젝트와 대화를 같은 고정됨 헤더 안에 합성한다.
  const pinnedSlot = useMemo(
    () => (
      <PinnedSection
        agentAppearance={agentUiPolicy}
        pinnedProjectIds={handlers.navProjectIds}
        currentSessionId={handlers.currentSessionId}
        onSelectSession={handlers.handleSelectSession}
        onTogglePinSession={handlers.handleTogglePinSession}
        onDeleteSession={handlers.handleDeleteSession}
        onRenameSession={handlers.handleRenameSession}
      >
        <PinnedProjectsSection
          embedded
          agentAppearance={agentUiPolicy}
          pinnedProjects={handlers.pinnedProjects}
          pinnedProjectIds={handlers.navProjectIds}
          currentSessionId={handlers.currentSessionId}
          onOpenProject={handlers.handleOpenProject}
          onTogglePinProject={handlers.handleTogglePinProject}
          onSelectSession={handlers.handleSelectSession}
          onTogglePinSession={handlers.handleTogglePinSession}
          onDeleteSession={handlers.handleDeleteSession}
          onRenameSession={handlers.handleRenameSession}
        />
      </PinnedSection>
    ),
    [
      handlers.navProjectIds,
      handlers.pinnedProjects,
      handlers.currentSessionId,
      handlers.handleOpenProject,
      handlers.handleTogglePinProject,
      handlers.handleSelectSession,
      handlers.handleTogglePinSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession
    ]
  )
  const sessionsSlot = useMemo(
    () => (
      <SessionList
        agentAppearance={agentUiPolicy}
        pinnedProjectIds={handlers.pinnedProjectIds}
        currentSessionId={handlers.currentSessionId}
        onSelect={handlers.handleSelectSession}
        onTogglePin={handlers.handleTogglePinSession}
        onDelete={handlers.handleDeleteSession}
        onRename={handlers.handleRenameSession}
        drafts={handlers.draftSessions}
        activeDraftKey={handlers.activeDraftKey}
        onSelectDraft={handlers.handleSelectDraft}
        onDeleteDraft={handlers.handleDeleteDraft}
      />
    ),
    [
      handlers.pinnedProjectIds,
      handlers.currentSessionId,
      handlers.handleSelectSession,
      handlers.handleTogglePinSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession,
      handlers.draftSessions,
      handlers.activeDraftKey,
      handlers.handleSelectDraft,
      handlers.handleDeleteDraft
    ]
  )
  return { projectsSlot, pinnedSlot, sessionsSlot, footerSlot }
}
