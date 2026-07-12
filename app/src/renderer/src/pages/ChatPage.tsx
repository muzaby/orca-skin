import { ChatView, useChatSession } from '../features/chat'
import { useBackendCapabilities, useBackendLabel } from '../features/backend'
import { formatApproxCost, useCostSummary, useProviderUsageLimits } from '../features/cost'
import { useOpenSettings, providerTabId } from '../features/settings'
import { useProjectsState } from '../features/projects'
import { useI18n } from '../shared/i18n'
import { useSessionActions } from './useSessionActions'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 여기서는 ChatView 1개 배치 +
// BackendContext 의 backendLabel / canAbort 를 props 로 wiring (cross-feature 결정 5번).
export function ChatPage(): React.JSX.Element {
  const { tr } = useI18n()
  const backendLabel = useBackendLabel()
  const capabilities = useBackendCapabilities()
  const summary = useCostSummary()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true
  const costToday = summary ? formatApproxCost(tr, summary.day.totalCostUsd) : undefined
  // 도넛 사용량 한도를 현재 세션 provider 기준으로(모델 선택 반영, 0082). providerKey 없으면 전역.
  const providerKey = useChatSession((s) => s.providerKey)
  const projectId = useChatSession((s) => s.projectId ?? s.pendingProjectId)
  const projectName = useProjectsState((s) =>
    projectId ? (s.list.find((project) => project.id === projectId)?.name ?? null) : null
  )
  const usageLimits = useProviderUsageLimits(providerKey)
  const openSettings = useOpenSettings()
  const sessionActions = useSessionActions({ redirectAfterActiveDelete: '/new' })
  return (
    <ChatView
      backendLabel={backendLabel}
      canAbort={canAbort}
      costToday={costToday}
      usageLimits={usageLimits}
      onOpenUsageSettings={(key) => openSettings(key ? providerTabId(key) : 'usage')}
      projectId={projectId}
      projectName={projectName}
      {...sessionActions}
    />
  )
}
