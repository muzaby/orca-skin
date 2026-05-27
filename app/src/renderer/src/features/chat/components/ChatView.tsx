import { useChatContext } from '../providers/ChatProvider'
import { ChatTile } from './ChatTile'

interface ChatViewProps {
  // BackendContext 는 cross-feature 이므로 page 가 wiring 으로 주입.
  backendLabel: string
}

export function ChatView({ backendLabel }: ChatViewProps): React.JSX.Element {
  const chat = useChatContext()
  return <ChatTile chat={chat} backendLabel={backendLabel} />
}
