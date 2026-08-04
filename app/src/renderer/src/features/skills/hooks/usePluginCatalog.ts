import { useCallback, useEffect, useState } from 'react'
import { authApi, pluginApi } from '../../../shared/api/ipc'
import type { AuthProviderInfo, PluginDiagnostic } from '../../../../../shared/ipc'
import { buildConnectorRows, type ConnectorRow } from '../lib/pluginCatalog'

export function usePluginCatalog(): {
  rows: ConnectorRow[]
  // 등록된 auth provider 전체 — 연결 모달이 커넥터의 수용 목록과 교집합을 잡는다(0163).
  providers: AuthProviderInfo[]
  // 부팅에서 거부된 것 (0164 r2). 빈 목록의 이유가 "설정이 거부됐다" 일 수 있고, 그때
  // 화면에 아무 흔적이 없으면 사용자는 자기 설정이 무시된 줄 모른다.
  diagnostics: PluginDiagnostic[]
  loading: boolean
  // 연결/해제 후 다시 읽는다 — `connected` 의 소유자는 main 이라 낙관적 갱신을 하지 않는다.
  refresh: () => void
} {
  const [rows, setRows] = useState<ConnectorRow[]>([])
  const [providers, setProviders] = useState<AuthProviderInfo[]>([])
  const [diagnostics, setDiagnostics] = useState<PluginDiagnostic[]>([])
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    let alive = true
    void Promise.all([authApi.providers(), pluginApi.list(), pluginApi.diagnostics()])
      .then(([registered, connectors, rejected]) => {
        if (!alive) return
        setProviders(registered)
        setRows(buildConnectorRows(registered, connectors))
        setDiagnostics(rejected)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [nonce])

  return { rows, providers, diagnostics, loading, refresh }
}
