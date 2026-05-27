import { useNavigation } from '../shared/navigation'
import { ChatTile, useChatContext, useProjectChatLanding } from '../features/chat'
import { useBackendContext } from '../features/backend'
import { ProjectLandingHeader, ProjectInstructionsSidebar } from '../features/projects'
import { ProjectSessionsPanel } from '../features/sessions'

interface ProjectLandingPageProps {
  projectId: string
}

// page = "어떤 Feature 를 배치할지" 결정 (조립 + cross-feature wiring).
// 모든 로직 (chat 라이프사이클, 세션 IPC, 모달 state) 은 feature 내부에 가둠;
// page 는 Context 읽기 + features 배치 + 인라인 wiring 만 수행.
export function ProjectLandingPage({ projectId }: ProjectLandingPageProps): React.JSX.Element {
  const { navigate } = useNavigation()
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()

  useProjectChatLanding(projectId, () => navigate('chat'))

  return (
    <section className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <ProjectLandingHeader projectId={projectId} onBack={() => navigate('projects')} />
        <div className="min-h-0 flex-1">
          <ChatTile chat={chat} backendLabel={backendLabel} />
        </div>
        <ProjectSessionsPanel
          projectId={projectId}
          currentSessionId={chat.state.sessionId}
          refreshOnTurnEnd={chat.state.inflight}
          onSessionSelected={(id) => void chat.loadSession(id)}
          onSessionDeleting={(id) => chat.handleSessionDeleted(id, projectId)}
          onSessionRenamed={chat.renameSession}
        />
      </div>
      <ProjectInstructionsSidebar projectId={projectId} />
    </section>
  )
}
