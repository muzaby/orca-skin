import { create } from 'zustand'

interface ProjectNavState {
  expanded: Record<string, boolean>
  announced: ReadonlySet<string>
}

// 행이 고정됨/프로젝트 사이를 이동하거나 목록이 늦게 도착해도 펼침 상태는 ID로 유지한다.
export const useProjectNavStore = create<ProjectNavState>()(() => ({
  expanded: {},
  announced: new Set()
}))

function setExpanded(projectId: string, expanded: boolean): void {
  useProjectNavStore.setState((state) => ({
    expanded: { ...state.expanded, [projectId]: expanded }
  }))
}

function announceCreated(projectId: string): boolean {
  const state = useProjectNavStore.getState()
  if (state.announced.has(projectId)) return false
  useProjectNavStore.setState({
    announced: new Set([...state.announced, projectId]),
    expanded: Object.hasOwn(state.expanded, projectId)
      ? state.expanded
      : { ...state.expanded, [projectId]: true }
  })
  return true
}

export const projectNavActions = { setExpanded, announceCreated }

export function useProjectExpanded(projectId: string): boolean {
  return useProjectNavStore((state) => state.expanded[projectId] ?? false)
}
