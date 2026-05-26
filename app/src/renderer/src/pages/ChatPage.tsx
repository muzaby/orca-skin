import { useChatContext } from '../app/providers/ChatProvider'
import { useBackendContext } from '../app/providers/BackendProvider'
import { ChatTile } from '../frame/ChatTile'

export function ChatPage(): React.JSX.Element {
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()
  return <ChatTile chat={chat} backendLabel={backendLabel} />
}
