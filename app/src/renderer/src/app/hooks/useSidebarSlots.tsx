import { useMemo, type ReactNode } from 'react'
import { SessionList } from '../../features/sessions'
import { SidebarUserButton } from '../SidebarUserButton'
import type { SessionHandlers } from './useSessionHandlers'

export interface SidebarSlots {
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
  const sessionsSlot = useMemo(
    () => (
      <SessionList
        currentSessionId={handlers.currentSessionId}
        projectNameById={handlers.projectNameById}
        onSelect={handlers.handleSelectSession}
        onDelete={handlers.handleDeleteSession}
        onRename={handlers.handleRenameSession}
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
      handlers.draftSessions,
      handlers.activeDraftKey,
      handlers.handleSelectDraft,
      handlers.handleDeleteDraft
    ]
  )
  return { sessionsSlot, footerSlot }
}
