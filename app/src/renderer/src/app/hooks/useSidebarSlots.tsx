import { useMemo, type ReactNode } from 'react'
import { SessionList } from '../../features/sessions'
import { BackendStatus } from '../../features/backend'
import type { SessionHandlers } from './useSessionHandlers'

export interface SidebarSlots {
  sessionsSlot: ReactNode
  footerSlot: ReactNode
}

// Sidebar 의 React.memo() 가 효과를 내려면 slot ReactNode 들이 referentially stable
// 해야 한다. AppLayout 이 chat.state.inflight 토글 등으로 리렌더돼도 slot identity 가
// 유지되어 Sidebar 가 skip 된다.
export function useSidebarSlots(handlers: SessionHandlers): SidebarSlots {
  const footerSlot = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <BackendStatus />
      </div>
    ),
    []
  )
  const sessionsSlot = useMemo(
    () => (
      <SessionList
        currentSessionId={handlers.currentSessionId}
        projectNameById={handlers.projectNameById}
        onSelect={handlers.handleSelectSession}
        onDelete={handlers.handleDeleteSession}
        onRename={handlers.handleRenameSession}
      />
    ),
    [
      handlers.currentSessionId,
      handlers.projectNameById,
      handlers.handleSelectSession,
      handlers.handleDeleteSession,
      handlers.handleRenameSession
    ]
  )
  return { sessionsSlot, footerSlot }
}
