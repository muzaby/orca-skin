import { createContext, useContext, type ReactNode } from 'react'
import { useProjects } from '../hooks/useProjects'

type UseProjectsReturn = ReturnType<typeof useProjects>

const ProjectsContext = createContext<UseProjectsReturn | null>(null)

export function ProjectsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const projects = useProjects()
  return <ProjectsContext.Provider value={projects}>{children}</ProjectsContext.Provider>
}

export function useProjectsContext(): UseProjectsReturn {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjectsContext must be used within ProjectsProvider')
  return ctx
}
