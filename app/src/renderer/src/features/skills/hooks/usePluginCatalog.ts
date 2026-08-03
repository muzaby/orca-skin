import { useEffect, useState } from 'react'
import { authApi, pluginApi } from '../../../shared/api/ipc'
import { buildPluginRows, type PluginRow } from '../lib/pluginCatalog'

export function usePluginCatalog(): { rows: PluginRow[]; loading: boolean } {
  const [rows, setRows] = useState<PluginRow[]>([])
  const [loading, setLoading] = useState(true)
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
  }, [])
  return { rows, loading }
}
