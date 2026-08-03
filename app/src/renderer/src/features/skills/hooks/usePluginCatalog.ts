import { useCallback, useEffect, useState } from 'react'
import { authApi, pluginApi } from '../../../shared/api/ipc'
import type { AuthProviderInfo } from '../../../../../shared/ipc'
import { buildConnectorRows, type ConnectorRow } from '../lib/pluginCatalog'

export function usePluginCatalog(): {
  rows: ConnectorRow[]
  // 등록된 auth provider 전체 — 연결 모달이 커넥터의 수용 목록과 교집합을 잡는다(0163).
  providers: AuthProviderInfo[]
  loading: boolean
  // 연결/해제 후 다시 읽는다 — `connected` 의 소유자는 main 이라 낙관적 갱신을 하지 않는다.
  refresh: () => void
} {
  const [rows, setRows] = useState<ConnectorRow[]>([])
  const [providers, setProviders] = useState<AuthProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    let alive = true
    void Promise.all([authApi.providers(), pluginApi.list()])
      .then(([registered, connectors]) => {
        if (!alive) return
        setProviders(registered)
        setRows(buildConnectorRows(registered, connectors))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [nonce])

  return { rows, providers, loading, refresh }
}
