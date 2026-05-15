import { useCallback, useEffect, useState } from 'react'
import type { Backend, BackendListResult } from '../../../shared/ipc'

export interface UseBackend {
  list: BackendListResult['backends']
  active: Backend | null
  loading: boolean
  refresh: () => Promise<void>
}

export function useBackend(): UseBackend {
  const [data, setData] = useState<BackendListResult | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const result = await window.orca.backend.list()
    setData(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    window.orca.backend.list().then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    list: data?.backends ?? [],
    active: data?.active ?? null,
    loading,
    refresh
  }
}
