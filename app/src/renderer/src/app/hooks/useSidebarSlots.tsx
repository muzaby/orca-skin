import { useMemo, type ReactNode } from 'react'
import { SessionList } from '../../features/sessions'
import type { SessionHandlers } from './useSessionHandlers'

export interface SidebarSlots {
  sessionsSlot: ReactNode
  footerSlot: ReactNode
}

// Sidebar 의 React.memo() 가 효과를 내려면 slot ReactNode 들이 referentially stable
// 해야 한다. AppLayout 이 chat.state.inflight 토글 등으로 리렌더돼도 slot identity 가
// 유지되어 Sidebar 가 skip 된다.
export function useSidebarSlots(handlers: SessionHandlers): SidebarSlots {
  // footer BackendStatus 는 보류 — 설치/백엔드 상태 기능이 완성되기 전까지 노출하지 않는다
  // (사용자 지시). footerSlot 이 비면 Sidebar 가 footer 컨테이너 자체를 렌더하지 않는다.
  const footerSlot = null
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
