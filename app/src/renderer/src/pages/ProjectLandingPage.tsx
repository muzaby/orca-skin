import { agentUiPolicy } from '../features/chat/lib/agentPresentation'
import { useNavigate, useParams } from 'react-router-dom'
import { AgentModeToggle, ChatTile, Composer, useChatBusy, useChatSession } from '../features/chat'
import { useBackendCapabilities, useBackendLabel } from '../features/backend'
import { useUsageForTelemetryProvider } from '../features/chat'
import { useOpenSettings, providerTabId } from '../features/settings'
import { ProjectInfoHero, projectsActions, useProjectsState } from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'
import { useSessionActions } from './useSessionActions'
import { useI18n } from '../shared/i18n'
import { Button } from '../shared/ui/Button'
import { ReadingColumn } from '../shared/ui/ReadingColumn'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 채팅 라이프사이클(랜딩 reset
// / 첫 턴 후 URL upgrade) 은 셸의 `useChatRouteSync` 가 담당하므로 여기서는 별도
// hook 호출 없이 순수 조립.
//
// 새 대화와 같은 좌우 경계의 단일 컬럼: 제목 → Composer → 대화 목록.
export function ProjectLandingPage(): React.JSX.Element {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const { tr } = useI18n()
  const navigate = useNavigate()
  const sessionId = useChatSession((s) => s.sessionId)
  const messages = useChatSession((s) => s.messages)
  const loadingSession = useChatSession((s) => s.loadingSession)
  // 0149 — listen 대기(백그라운드 서브에이전트)도 busy(useChatBusy 단일 정의).
  const inflight = useChatBusy()
  const backendLabel = useBackendLabel()
  const capabilities = useBackendCapabilities()
  // 능력 서술자가 로드됐는데 sessionAbort 가 아니면 중단 게이팅(미로드면 현행 동작 유지).
  const canAbort = capabilities ? capabilities.cancellation.sessionAbort === true : true
  // 도넛 사용량 한도 — **마지막 telemetry 시점의 provider** 기준(0186). 모델을 바꿔도 새 턴이
  // 끝나기 전에는 숫자가 바뀌지 않는다.
  const usageLimits = useUsageForTelemetryProvider()
  const openSettings = useOpenSettings()
  const onOpenUsageSettings = (key?: string): void =>
    openSettings(key ? providerTabId(key) : 'usage')
  const projectName = useProjectsState((s) =>
    projectId ? (s.list.find((project) => project.id === projectId)?.name ?? null) : null
  )
  const projectsLoading = useProjectsState((s) => s.loading)
  const sessionActions = useSessionActions({
    deleteFallbackProjectId: projectId,
    redirectAfterActiveDelete: `/projects/${projectId}`
  })
  const isEmpty = messages.length === 0 && !loadingSession

  // A direct URL can arrive before the catalog. Do not expose a Composer seeded with Desktop.
  if (isEmpty && projectName == null) {
    return (
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 px-8">
        <p role="status" className="text-[14px] text-ink3">
          {tr(projectsLoading ? 'common.loading' : 'projects.unavailable')}
        </p>
        {!projectsLoading && (
          <Button onClick={() => void projectsActions.refresh().catch(() => undefined)}>
            {tr('projects.retry')}
          </Button>
        )}
      </section>
    )
  }

  if (!isEmpty) {
    return (
      <ChatTile
        backendLabel={backendLabel}
        canAbort={canAbort}
        usageLimits={usageLimits}
        onOpenUsageSettings={onOpenUsageSettings}
        projectId={projectId}
        projectName={projectName}
        {...sessionActions}
      />
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 bg-bg">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4">
        <div className="mx-auto w-full max-w-[720px] min-w-0 pb-10 pt-10">
          <ReadingColumn>
            <main className="flex min-w-0 flex-col gap-6">
              <ProjectInfoHero key={projectId} projectId={projectId} />
              <AgentModeToggle />
              <Composer
                backendLabel={backendLabel}
                canAbort={canAbort}
                usageLimits={usageLimits}
                onOpenUsageSettings={onOpenUsageSettings}
                flush
                showLandingCwdPanel
              />
              <ProjectSessionsPanel
                agentAppearance={agentUiPolicy}
                projectId={projectId}
                currentSessionId={sessionId}
                refreshOnTurnEnd={inflight}
                onSessionSelected={(id) => navigate(`/chat/${id}`)}
                onDeleteSession={sessionActions.onDeleteSession}
                onRenameSession={sessionActions.onRenameSession}
              />
            </main>
          </ReadingColumn>
        </div>
      </div>
    </section>
  )
}
