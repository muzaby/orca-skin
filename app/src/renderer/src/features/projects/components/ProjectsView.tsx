import { useNavigate } from 'react-router-dom'
import { useProjectsContext } from '../providers/ProjectsProvider'
import { ProjectsScreen } from './ProjectsScreen'

export function ProjectsView(): React.JSX.Element {
  const { list, loading, create } = useProjectsContext()
  const navigate = useNavigate()
  return (
    <ProjectsScreen
      projects={list}
      loading={loading}
      onOpenProject={(id) => navigate(`/projects/${id}`)}
      onCreate={async (name, instructions) => {
        await create(name, instructions)
      }}
    />
  )
}
