import { useNavigate, useParams } from 'react-router-dom'
import { ChatTile, useChatContext } from '../features/chat'
import { useBackendContext } from '../features/backend'
import { ProjectLandingHeader, ProjectInstructionsSidebar } from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'

// page = "어떤 Feature 를 배치할지" 결정 (조립만). 채팅 라이프사이클(랜딩 reset
// / 첫 턴 후 URL upgrade) 은 셸의 `useChatRouteSync` 가 담당하므로 여기서는 별도
// hook 호출 없이 순수 조립.
export function ProjectLandingPage(): React.JSX.Element {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()

  return (
    <section className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <ProjectLandingHeader projectId={projectId} onBack={() => navigate('/projects')} />
        <div className="min-h-0 flex-1">
          <ChatTile chat={chat} backendLabel={backendLabel} />
        </div>
        <ProjectSessionsPanel
          projectId={projectId}
          currentSessionId={chat.state.sessionId}
          refreshOnTurnEnd={chat.state.inflight}
          onSessionSelected={(id) => navigate(`/chat/${id}`)}
          onSessionDeleting={(id) => chat.handleSessionDeleted(id, projectId)}
          onSessionRenamed={chat.renameSession}
        />
      </div>
      <ProjectInstructionsSidebar projectId={projectId} />
    </section>
  )
}
