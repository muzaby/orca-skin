import { useNavigate, useParams } from 'react-router-dom'
import { Composer, useChatContext } from '../features/chat'
import { useBackendContext } from '../features/backend'
import { ProjectLandingHeader, ProjectInstructionsSidebar } from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 채팅 라이프사이클(랜딩 reset
// / 첫 턴 후 URL upgrade) 은 셸의 `useChatRouteSync` 가 담당하므로 여기서는 별도
// hook 호출 없이 순수 조립. 본 랜딩은 "허브" 모델 — transcript 없이 Composer +
// 최근 대화 목록을 본문에 수직 배치하고, 우측(또는 reflow 시 하단)에 지침/파일
// 사이드바. 첫 메시지 송신 후엔 `useChatRouteSync` 가 `/chat/<id>` 로 upgrade.
export function ProjectLandingPage(): React.JSX.Element {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()

  return (
    <section className="flex min-w-0 flex-1 flex-col xl:flex-row">
      <main className="flex min-w-0 flex-1 flex-col bg-bg">
        <ProjectLandingHeader projectId={projectId} onBack={() => navigate('/projects')} />
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
          <Composer chat={chat} backendLabel={backendLabel} />
          <ProjectSessionsPanel
            projectId={projectId}
            currentSessionId={chat.state.sessionId}
            refreshOnTurnEnd={chat.state.inflight}
            onSessionSelected={(id) => navigate(`/chat/${id}`)}
            onSessionDeleting={(id) => chat.handleSessionDeleted(id, projectId)}
            onSessionRenamed={chat.renameSession}
          />
        </div>
      </main>
      <aside className="flex flex-none flex-col border-t border-border bg-bg xl:w-[320px] xl:border-l xl:border-t-0">
        <ProjectInstructionsSidebar projectId={projectId} />
      </aside>
    </section>
  )
}
