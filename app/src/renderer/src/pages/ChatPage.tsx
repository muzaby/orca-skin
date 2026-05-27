import { ChatView } from '../features/chat'
import { useBackendContext } from '../features/backend'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 여기서는 ChatView 1개 배치 +
// BackendContext 의 backendLabel 을 props 로 wiring (cross-feature 결정 5번).
export function ChatPage(): React.JSX.Element {
  const { backendLabel } = useBackendContext()
  return <ChatView backendLabel={backendLabel} />
}
