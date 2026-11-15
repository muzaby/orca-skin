// Zustand projects store — 구 ProjectsProvider(Context)의 전환(handoff 0013).
// 프로젝트 카탈로그. main 의 projects 테이블이 SSOT — 부팅 1회 list 후 모든 mutation
// 직후 refresh 로 동기화. 삭제는 DB 성공 직후 로컬 목록에서 제거한다.

import { create } from 'zustand'
import type { Project } from '../../../../../shared/ipc'
import { basenameForDisplay } from '../../../../../shared/path-basename'
import { fileApi, projectApi } from '../../../shared/api/ipc'

interface ProjectsStoreState {
  list: Project[]
  loading: boolean
}

export const useProjectsStore = create<ProjectsStoreState>()(() => ({
  list: [],
  loading: true
}))

const { setState } = useProjectsStore
const deletedProjectIds = new Set<string>()

export async function initProjects(): Promise<void> {
  try {
    const items = await projectApi.list()
    setState({ list: items.filter((item) => !deletedProjectIds.has(item.id)), loading: false })
  } catch (error) {
    setState({ loading: false })
    throw error
  }
}

async function createProject(name: string, instructions: string): Promise<Project> {
  const created = await projectApi.create({ name, instructions })
  await initProjects()
  return created
}

// 폴더를 골라 그 경로의 프로젝트를 돌려준다. main 이 같은 경로의 기존 프로젝트를 재사용하므로
// 이미 있는 폴더를 골라도 새로 생기지 않는다. 취소면 null.
async function addFromDirectory(): Promise<Project | null> {
  const cwd = await fileApi.pickDirectory()
  if (!cwd) return null
  const project = await projectApi.create({ name: basenameForDisplay(cwd), instructions: '', cwd })
  await initProjects()
  return project
}

async function update(id: string, patch: { name?: string; instructions?: string }): Promise<void> {
  await projectApi.update({ id, ...patch })
  await initProjects()
}

async function remove(id: string): Promise<void> {
  await projectApi.delete(id)
  deletedProjectIds.add(id)
  setState((state) => ({ list: state.list.filter((project) => project.id !== id) }))
}

// 0129 고정 토글 — main 이 pinned_at 을 시각/null 로 기록. 이후 refresh 로 목록 갱신.
async function setPinned(id: string, pinned: boolean): Promise<void> {
  await projectApi.setPinned(id, pinned)
  await initProjects()
}

export const projectsActions = {
  refresh: initProjects,
  create: createProject,
  addFromDirectory,
  update,
  remove,
  setPinned
}

export function useProjectsState<T>(selector: (s: ProjectsStoreState) => T): T {
  return useProjectsStore(selector)
}
