import { useCallback, useEffect, useState } from 'react'
import type { Backend, BackendListResult, ProviderDescriptor } from '../../../../../shared/ipc'
import { backendApi } from '../../../shared/api/ipc'

export interface UseBackend {
  list: BackendListResult['backends']
  active: Backend | null
  // 활성 백엔드의 능력 서술자 (없으면 null). UI 의 사전 게이팅·지표 소비자가 읽는다(§15).
  capabilities: ProviderDescriptor | null
  loading: boolean
  refresh: () => Promise<void>
}

export function useBackend(): UseBackend {
  const [data, setData] = useState<BackendListResult | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const result = await backendApi.list()
    setData(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    backendApi.list().then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const capabilities = data?.backends.find((b) => b.id === data.active)?.capabilities ?? null

  return {
    list: data?.backends ?? [],
    active: data?.active ?? null,
    capabilities,
    loading,
    refresh
  }
}
