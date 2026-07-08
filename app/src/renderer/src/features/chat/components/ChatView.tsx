import { ChatTile } from './ChatTile'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'

interface ChatViewProps {
  // BackendContext 는 cross-feature 이므로 page 가 wiring 으로 주입.
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page 가 capabilities 에서 도출해 주입.
  canAbort: boolean
  costToday?: string
  usageLimits?: UsageLimitsView | null
  // providerKey = 도넛에서 현재 선택된 provider(있으면 그 서브탭으로, 없으면 전역 사용량 탭).
  onOpenUsageSettings?: (providerKey?: string) => void
}

// 채팅 상태는 ChatTile 내부가 chatStore selector 로 직접 구독한다 — 여기는 cross-feature
// props 패스스루만 남는다.
export function ChatView({
  backendLabel,
  canAbort,
  costToday,
  usageLimits,
  onOpenUsageSettings
}: ChatViewProps): React.JSX.Element {
  return (
    <ChatTile
      backendLabel={backendLabel}
      canAbort={canAbort}
      costToday={costToday}
      usageLimits={usageLimits}
      onOpenUsageSettings={onOpenUsageSettings}
    />
  )
}
