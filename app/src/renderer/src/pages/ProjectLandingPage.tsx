import { useNavigate, useParams } from 'react-router-dom'
import { chatActions, ChatTile, Composer, useChatBusy, useChatSession } from '../features/chat'
import { useBackendCapabilities, useBackendLabel } from '../features/backend'
import { useUsageForTelemetryProvider } from './useUsageForTelemetryProvider'
import { useOpenSettings, providerTabId } from '../features/settings'
import {
  ProjectInfoHero,
  ProjectInstructionsSidebar,
  ProjectLandingHeader,
  useProjectsState
} from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'
import { useSessionActions } from './useSessionActions'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 채팅 라이프사이클(랜딩 reset
// / 첫 턴 후 URL upgrade) 은 셸의 `useChatRouteSync` 가 담당하므로 여기서는 별도
// hook 호출 없이 순수 조립.
//
// 레이아웃 슬롯:
// - HEADER (풀-너비): ProjectLandingHeader — "모든 프로젝트" 링크만.
// - LEFT col-span-3: ProjectInfoHero (제목/지침/메타) → Composer → 세션 목록.
// - RIGHT col-span-2: ProjectInstructionsSidebar (지침 + 파일 placeholder).
// 중앙:우측 = 6:4. 두 패널은 max-w-[1200px] mx-auto 단일 블록 안에서 고정 gap(gap-x-10)
// 으로 묶이고, 창이 1200px 를 넘으면 패널 간 간격이 아니라 좌우 바깥 여백이 커진다.
// xl 미만(< 1280px)에서는 단일 컬럼 자연 스택. 구조 구분선(헤더 하단·패널 사이)은 없음.
export function ProjectLandingPage(): React.JSX.Element {
  const { projectId = '' } = useParams<{ projectId: string }>()
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
  const sessionActions = useSessionActions({
    deleteFallbackProjectId: projectId,
    redirectAfterActiveDelete: `/projects/${projectId}`
  })
  const isEmpty = messages.length === 0 && !loadingSession

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
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <ProjectLandingHeader onBack={() => navigate('/projects')} />
      <div className="mx-auto grid w-full max-w-[1200px] min-w-0 flex-1 grid-cols-1 gap-y-6 px-6 py-8 xl:grid-cols-5 xl:gap-x-10">
        <main className="flex min-w-0 flex-col space-y-6 xl:col-span-3">
          <ProjectInfoHero projectId={projectId} />
          <Composer
            backendLabel={backendLabel}
            canAbort={canAbort}
            usageLimits={usageLimits}
            onOpenUsageSettings={onOpenUsageSettings}
            flush
            showLandingCwdPanel
          />
          <ProjectSessionsPanel
            projectId={projectId}
            currentSessionId={sessionId}
            refreshOnTurnEnd={inflight}
            onSessionSelected={(id) => navigate(`/chat/${id}`)}
            onSessionDeleting={(id) => chatActions.handleSessionDeleted(id, projectId)}
            onSessionRenamed={chatActions.renameSession}
          />
        </main>
        <aside className="min-w-0 xl:col-span-2">
          <ProjectInstructionsSidebar projectId={projectId} />
        </aside>
      </div>
    </section>
  )
}
