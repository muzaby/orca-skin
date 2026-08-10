import { useCallback, useEffect, useState } from 'react'
import type {
  ProviderAuthKind,
  ProviderInfo,
  ProviderPlatformState,
  ProviderStepInfo
} from '../../../../../shared/ipc'
import { providerApi } from '../../../shared/api/ipc'

export interface UseProviders {
  list: ProviderInfo[]
  step: ProviderStepInfo | null
  loading: boolean
  login: (providerId: string, authKind?: ProviderAuthKind) => Promise<void>
  submit: (providerId: string, input: Record<string, string>) => Promise<void>
  reauth: (providerId: string, authKind?: ProviderAuthKind) => Promise<void>
  revoke: (providerId: string) => Promise<void>
  clearStep: () => void
}

// provider 카탈로그. mcp/projects 와 다른 점은 **폴링이 없다**는 것 — main 이 grant 변화마다
// `orca:provider:state` 를 push 하므로 초기 스냅샷 1회 + 구독으로 동기화가 끝난다. 로그인은
// 브라우저 창처럼 renderer 밖에서 끝나는 흐름이 있어, 응답만 기다리면 화면이 뒤처진다.
export function useProviders(): UseProviders {
  const [list, setList] = useState<ProviderInfo[]>([])
  const [step, setStep] = useState<ProviderStepInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const absorb = (state: ProviderPlatformState): void => {
      if (cancelled) return
      setList(state.providers)
      setStep(state.step)
      setLoading(false)
    }
    providerApi
      .state()
      .then(absorb)
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    const off = providerApi.onState(absorb)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  // 단계는 push 로도 오지만, invoke 응답을 바로 반영해야 클릭 직후 폼이 뜬다.
  const login = useCallback(async (providerId: string, authKind?: ProviderAuthKind) => {
    setStep(await providerApi.login({ providerId, ...(authKind ? { authKind } : {}) }))
  }, [])

  const submit = useCallback(async (providerId: string, input: Record<string, string>) => {
    setStep(await providerApi.continue({ providerId, input }))
  }, [])

  const reauth = useCallback(async (providerId: string, authKind?: ProviderAuthKind) => {
    setStep(await providerApi.reauth({ providerId, ...(authKind ? { authKind } : {}) }))
  }, [])

  const revoke = useCallback(async (providerId: string) => {
    await providerApi.revoke({ providerId })
    setStep(null)
  }, [])

  const clearStep = useCallback(() => setStep(null), [])

  return { list, step, loading, login, submit, reauth, revoke, clearStep }
}
