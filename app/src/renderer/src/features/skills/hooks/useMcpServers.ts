import { useCallback, useEffect, useState } from 'react'
import type {
  CreateMcpServerRequest,
  McpServer,
  UpdateMcpServerRequest
} from '../../../../../shared/ipc'
import { mcpApi } from '../../../shared/api/ipc'

export interface UseMcpServers {
  list: McpServer[]
  loading: boolean
  refresh: () => Promise<void>
  add: (req: CreateMcpServerRequest) => Promise<void>
  update: (req: UpdateMcpServerRequest) => Promise<void>
  toggle: (id: string, enabled: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
}

// 전역 MCP 서버 카탈로그. useProjects 와 동형 — main 의 electron-store 가 SSOT,
// 부팅 시 1회 list 후 모든 mutation 직후 refresh 로 동기화.
export function useMcpServers(): UseMcpServers {
  const [list, setList] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const items = await mcpApi.list()
    setList(items)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    mcpApi
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

  const add = useCallback(
    async (req: CreateMcpServerRequest) => {
      await mcpApi.add(req)
      await refresh()
    },
    [refresh]
  )

  const update = useCallback(
    async (req: UpdateMcpServerRequest) => {
      await mcpApi.update(req)
      await refresh()
    },
    [refresh]
  )

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      await mcpApi.update({ id, enabled })
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await mcpApi.delete(id)
      await refresh()
    },
    [refresh]
  )

  return { list, loading, refresh, add, update, toggle, remove }
}
