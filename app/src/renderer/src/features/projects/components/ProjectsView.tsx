import { useProjectsContext } from '../providers/ProjectsProvider'
import { useNavigation } from '../../../shared/navigation'
import { ProjectsScreen } from './ProjectsScreen'

export function ProjectsView(): React.JSX.Element {
  const { list, loading, create } = useProjectsContext()
  const { navigate } = useNavigation()
  return (
    <ProjectsScreen
      projects={list}
      loading={loading}
      onOpenProject={(id) => navigate('project-detail', { projectId: id })}
      onCreate={async (name, instructions) => {
        await create(name, instructions)
      }}
    />
  )
}
