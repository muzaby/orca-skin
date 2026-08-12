import { ChatView, useChatSession } from '../features/chat'
import { useBackendCapabilities, useBackendLabel } from '../features/backend'
import { useUsageForTelemetryProvider } from './useUsageForTelemetryProvider'
import { useOpenSettings, providerTabId } from '../features/settings'
import { useProjectsState } from '../features/projects'
import { useSessionActions } from './useSessionActions'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 여기서는 ChatView 1개 배치 +
// BackendContext 의 backendLabel / canAbort 를 props 로 wiring (cross-feature 결정 5번).
export function ChatPage(): React.JSX.Element {
  const backendLabel = useBackendLabel()
  const capabilities = useBackendCapabilities()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true
  // 도넛 사용량 한도 — **마지막 telemetry 시점의 provider** 기준(0186). 모델을 바꿔도 새 턴이
  // 끝나기 전에는 숫자가 바뀌지 않는다.
  const projectId = useChatSession((s) => s.projectId ?? s.pendingProjectId)
  const projectName = useProjectsState((s) =>
    projectId ? (s.list.find((project) => project.id === projectId)?.name ?? null) : null
  )
  const usageLimits = useUsageForTelemetryProvider()
  const openSettings = useOpenSettings()
  const sessionActions = useSessionActions({ redirectAfterActiveDelete: '/new' })
  return (
    <ChatView
      backendLabel={backendLabel}
      canAbort={canAbort}
      usageLimits={usageLimits}
      onOpenUsageSettings={(key) => openSettings(key ? providerTabId(key) : 'usage')}
      projectId={projectId}
      projectName={projectName}
      {...sessionActions}
    />
  )
}
