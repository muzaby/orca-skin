import { useChatContext } from '../../../app/providers/ChatProvider'
import { useBackendContext } from '../../../app/providers/BackendProvider'
import { useProjectsContext } from '../../../app/providers/ProjectsProvider'
import { useNavigation } from '../../../app/providers/NavigationProvider'
import { ProjectDetailScreen } from './ProjectDetailScreen'

interface ProjectDetailViewProps {
  projectId: string
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps): React.JSX.Element {
  const chat = useChatContext()
  const { backendLabel } = useBackendContext()
  const { list: projects, update } = useProjectsContext()
  const { navigate } = useNavigation()
  return (
    <ProjectDetailScreen
      projectId={projectId}
      projects={projects}
      chat={chat}
      backendLabel={backendLabel}
      onBack={() => navigate('projects')}
      onLeaveToChat={() => navigate('chat')}
      onUpdateInstructions={async (instructions) => {
        await update(projectId, { instructions })
      }}
    />
  )
}
