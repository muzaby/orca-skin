import { ChatTile } from './ChatTile'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'

interface ChatViewProps {
  projectName?: string | null
  projectPath?: string | null
  // BackendContext 는 cross-feature 이므로 page 가 wiring 으로 주입.
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page 가 capabilities 에서 도출해 주입.
  canAbort: boolean
  usageLimits?: UsageLimitsView | null
  // providerKey = 도넛에서 현재 선택된 provider(있으면 그 서브탭으로, 없으면 전역 사용량 탭).
  onOpenUsageSettings?: (providerKey?: string) => void
  // '+' 메뉴 '플러그인 관리' — 페이지가 navigate('/plugins') 를 주입한다(0259 D-010).
  onManagePlugins?: () => void
  onDeleteSession?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
  sessionPinned?: boolean
  onTogglePinSession?: (sessionId: string, pinned: boolean) => void
}

// 채팅 상태는 ChatTile 내부가 chatStore selector 로 직접 구독한다 — 여기는 cross-feature
// props 패스스루만 남는다.
export function ChatView({
  projectName,
  projectPath,
  backendLabel,
  canAbort,
  usageLimits,
  onOpenUsageSettings,
  onManagePlugins,
  onDeleteSession,
  onRenameSession,
  sessionPinned,
  onTogglePinSession
}: ChatViewProps): React.JSX.Element {
  return (
    <ChatTile
      projectName={projectName}
      projectPath={projectPath}
      backendLabel={backendLabel}
      canAbort={canAbort}
      usageLimits={usageLimits}
      onOpenUsageSettings={onOpenUsageSettings}
      onManagePlugins={onManagePlugins}
      onDeleteSession={onDeleteSession}
      onRenameSession={onRenameSession}
      sessionPinned={sessionPinned}
      onTogglePinSession={onTogglePinSession}
    />
  )
}
