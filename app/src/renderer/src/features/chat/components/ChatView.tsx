import { useChatContext } from '../../../app/providers/ChatProvider'
import { useBackendContext } from '../../../app/providers/BackendProvider'
import { ChatTile } from './ChatTile'

// ChatPage 의 *조립* 책임을 features/ 안으로 끌어왔다. pages/ChatPage.tsx 는 이제
// <ChatView /> 만 렌더하며, ChatContext + BackendContext 결합은 features/chat 내부 일.
export function ChatView(): React.JSX.Element {
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()
  return <ChatTile chat={chat} backendLabel={backendLabel} />
}
