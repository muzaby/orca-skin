import { useNavigation } from './providers/NavigationProvider'
import { ChatPage } from '../pages/ChatPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { EnginePage } from '../pages/EnginePage'
import { SkillsPage } from '../pages/SkillsPage'
import { CapturesPage } from '../pages/CapturesPage'

export function AppRouter(): React.JSX.Element {
  const { current, params } = useNavigation()
  switch (current) {
    case 'chat':
      return <ChatPage />
    case 'projects':
      return <ProjectsPage />
    case 'project-detail':
      return <ProjectDetailPage projectId={params.projectId ?? ''} />
    case 'engine':
      return <EnginePage />
    case 'skills':
      return <SkillsPage />
    case 'captures':
    default:
      return <CapturesPage />
  }
}
