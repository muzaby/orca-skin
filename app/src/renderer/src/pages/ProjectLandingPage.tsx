import { useNavigate, useParams } from 'react-router-dom'
import { ChatTile, useChatContext, useProjectChatLanding } from '../features/chat'
import { useBackendContext } from '../features/backend'
import { ProjectLandingHeader, ProjectInstructionsSidebar } from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'

// page = "어떤 Feature 를 배치할지" 결정 (조립 + cross-feature wiring).
// 모든 로직 (chat 라이프사이클, 세션 IPC, 모달 state) 은 feature 내부에 가둠;
// page 는 useParams 로 URL 에서 projectId 를 읽고 features 를 배치 + 인라인 wiring 만 수행.
export function ProjectLandingPage(): React.JSX.Element {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()

  // 활성 신호 — 사용자가 입력하거나 세션 클릭으로 랜딩을 떠난다. 시점에 sessionId 가
  // 채워져 있으면 그 세션의 chat 경로로, 아니면 빈 새 대화로.
  useProjectChatLanding(projectId, () => {
    const sid = chat.state.sessionId
    navigate(sid ? `/chat/${sid}` : '/new')
  })

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
