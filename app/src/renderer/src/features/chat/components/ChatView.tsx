import { useChatContext } from '../providers/ChatProvider'
import { ChatTile } from './ChatTile'

interface ChatViewProps {
  // BackendContext 는 cross-feature 이므로 page 가 wiring 으로 주입.
  backendLabel: string
  // 활성 백엔드의 중단 지원 여부(§15). page 가 capabilities 에서 도출해 주입.
  canAbort: boolean
}

export function ChatView({ backendLabel, canAbort }: ChatViewProps): React.JSX.Element {
  const chat = useChatContext()
  return <ChatTile chat={chat} backendLabel={backendLabel} canAbort={canAbort} />
}
