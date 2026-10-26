import type { Project } from '../../../../../shared/ipc'
import { directoryIdentity } from '../../../../../shared/extra-directories'

export interface LandingProjects {
  items: readonly Pick<Project, 'id' | 'name' | 'cwd'>[]
  loading: boolean
}

export function landingProjectOptions(
  items: LandingProjects['items'],
  query = ''
): (LandingProjects['items'][number] & { cwd: string })[] {
  const needle = query.trim().toLocaleLowerCase()
  return items.filter(
    (item): item is typeof item & { cwd: string } =>
      item.cwd !== null &&
      (!needle ||
        item.name.toLocaleLowerCase().includes(needle) ||
        item.cwd.toLocaleLowerCase().includes(needle))
  )
}

export function projectForDirectory(
  items: LandingProjects['items'],
  cwd: string
): LandingProjects['items'][number] | undefined {
  return items.find(
    (item) => item.cwd !== null && directoryIdentity(item.cwd) === directoryIdentity(cwd)
  )
}

export function isSelectedProject(
  item: { id: string; cwd: string },
  cwd: string | null,
  projectId: string | null
): boolean {
  return (
    cwd !== null &&
    directoryIdentity(item.cwd) === directoryIdentity(cwd) &&
    (projectId === null || projectId === item.id)
  )
}
