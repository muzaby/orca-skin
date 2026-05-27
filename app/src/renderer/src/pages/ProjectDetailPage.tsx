import { ProjectDetailView } from '../features/projects'

interface ProjectDetailPageProps {
  projectId: string
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps): React.JSX.Element {
  return <ProjectDetailView projectId={projectId} />
}
