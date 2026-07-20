import { useMemo, type ReactNode } from 'react'
import { PinnedSection, SessionList } from '../../features/sessions'
import { SidebarUserButton } from '../SidebarUserButton'
import type { SessionHandlers } from './useSessionHandlers'

export interface SidebarSlots {
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
  // 0129 "고정됨" 섹션 — 최근 대화 위. 고정 항목이 없으면 PinnedSection 이 null 반환.
  const pinnedSlot = useMemo(
    () => (
      <PinnedSection
        pinnedProjects={handlers.pinnedProjects}
        currentSessionId={handlers.currentSessionId}
        onSelectSession={handlers.handleSelectSession}
        onTogglePinSession={handlers.handleTogglePinSession}
        onOpenProject={handlers.handleOpenProject}
        onTogglePinProject={handlers.handleTogglePinProject}
        onDeleteSession={handlers.handleDeleteSession}
        onRenameSession={handlers.handleRenameSession}
      />
    ),
    [
      handlers.pinnedProjects,
      handlers.currentSessionId,
      handlers.handleSelectSession,
      handlers.handleTogglePinSession,
      handlers.handleOpenProject,
      handlers.handleTogglePinProject,
      handlers.handleDeleteSession,
      handlers.handleRenameSession
    ]
  )
  const sessionsSlot = useMemo(
    () => (
      <SessionList
        currentSessionId={handlers.currentSessionId}
        projectNameById={handlers.projectNameById}
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
  return { pinnedSlot, sessionsSlot, footerSlot }
}
