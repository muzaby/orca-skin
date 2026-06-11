import { ChatView } from '../features/chat'
import { useBackendCapabilities, useBackendLabel } from '../features/backend'
import { formatApproxCost, useCostSummary } from '../features/cost'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 여기서는 ChatView 1개 배치 +
// BackendContext 의 backendLabel / canAbort 를 props 로 wiring (cross-feature 결정 5번).
export function ChatPage(): React.JSX.Element {
  const backendLabel = useBackendLabel()
  const capabilities = useBackendCapabilities()
  const summary = useCostSummary()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true
  const costToday = summary ? formatApproxCost(summary.day.totalCostUsd) : undefined
  return <ChatView backendLabel={backendLabel} canAbort={canAbort} costToday={costToday} />
}
