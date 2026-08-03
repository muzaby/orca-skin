import { useCallback, useEffect, useState } from 'react'
import { authApi, pluginApi } from '../../../shared/api/ipc'
import { buildPluginRows, type PluginRow } from '../lib/pluginCatalog'

export function usePluginCatalog(): {
  rows: PluginRow[]
  loading: boolean
  // 연결/해제 후 다시 읽는다 — `connected` 의 소유자는 main 이라 낙관적 갱신을 하지 않는다.
  refresh: () => void
} {
  const [rows, setRows] = useState<PluginRow[]>([])
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    let alive = true
    void Promise.all([authApi.providers(), pluginApi.list()])
      .then(([providers, connectors]) => {
        if (alive) setRows(buildPluginRows(providers, connectors))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [nonce])

  return { rows, loading, refresh }
}
