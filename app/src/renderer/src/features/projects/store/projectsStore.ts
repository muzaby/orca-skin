// Zustand projects store — 구 ProjectsProvider(Context)의 전환(handoff 0013).
// 프로젝트 카탈로그. main 의 projects 테이블이 SSOT — 부팅 1회 list 후 모든 mutation
// 직후 refresh 로 동기화(sessionsStore 와 동형).

import { create } from 'zustand'
import type { Project } from '../../../../../shared/ipc'
import { projectApi } from '../../../shared/api/ipc'

interface ProjectsStoreState {
  list: Project[]
  loading: boolean
}

export const useProjectsStore = create<ProjectsStoreState>()(() => ({
  list: [],
  loading: true
}))

const { setState } = useProjectsStore

export async function initProjects(): Promise<void> {
  try {
    const items = await projectApi.list()
    setState({ list: items, loading: false })
  } catch (error) {
    setState({ loading: false })
    throw error
  }
}

async function refresh(): Promise<void> {
  await initProjects()
}

async function createProject(name: string, instructions: string): Promise<Project> {
  const created = await projectApi.create({ name, instructions })
  await refresh()
  return created
}

async function update(id: string, patch: { name?: string; instructions?: string }): Promise<void> {
  await projectApi.update({ id, ...patch })
  await refresh()
}

async function remove(id: string): Promise<void> {
  await projectApi.delete(id)
  await refresh()
}

export const projectsActions = { refresh, create: createProject, update, remove }

export function subscribeProjects(): () => void {
  return () => undefined
}

export function bootstrapProjects(): () => void {
  void initProjects().catch(() => undefined)
  return subscribeProjects()
}

export function useProjectsState<T>(selector: (s: ProjectsStoreState) => T): T {
  return useProjectsStore(selector)
}
