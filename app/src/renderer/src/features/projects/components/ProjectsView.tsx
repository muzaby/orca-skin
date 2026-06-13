import { useNavigate } from 'react-router-dom'
import { projectsActions, useProjectsState } from '../store/projectsStore'
import { ProjectsScreen } from './ProjectsScreen'

export function ProjectsView(): React.JSX.Element {
  const list = useProjectsState((s) => s.list)
  const loading = useProjectsState((s) => s.loading)
  const { create } = projectsActions
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
