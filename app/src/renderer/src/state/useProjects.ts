import { useCallback, useEffect, useState } from 'react'
import type { Project } from '../../../shared/ipc'

export interface UseProjects {
  list: Project[]
  loading: boolean
  refresh: () => Promise<void>
  create: (name: string, instructions: string) => Promise<Project>
  update: (id: string, patch: { name?: string; instructions?: string }) => Promise<void>
  remove: (id: string) => Promise<void>
}

// 프로젝트 카탈로그. useSessions 와 동형 — main 의 projects 테이블이 SSOT, 부팅 시
// 1회 list 후 모든 mutation 직후 refresh 로 동기화.
export function useProjects(): UseProjects {
  const [list, setList] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const items = await window.orca.project.list()
    setList(items)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    window.orca.project
      .list()
      .then((items) => {
        if (cancelled) return
        setList(items)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const create = useCallback(
    async (name: string, instructions: string) => {
      const created = await window.orca.project.create({ name, instructions })
      await refresh()
      return created
    },
    [refresh]
  )

  const update = useCallback(
    async (id: string, patch: { name?: string; instructions?: string }) => {
      await window.orca.project.update({ id, ...patch })
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await window.orca.project.delete(id)
      await refresh()
    },
    [refresh]
  )

  return { list, loading, refresh, create, update, remove }
}
