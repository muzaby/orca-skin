import { useProjectsContext } from '../app/providers/ProjectsProvider'
import { useNavigation } from '../app/providers/NavigationProvider'
import { ProjectsScreen } from '../screens/ProjectsScreen'

export function ProjectsPage(): React.JSX.Element {
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
