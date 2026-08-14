import { useCallback, useEffect, useRef, useState } from 'react'
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
  //
  // **늦게 도착한 응답은 버린다.** invoke 는 probe 왕복만큼 걸리므로, 사용자가 그 사이 다시
  // 제출하거나 [연결 해제] 를 누르면 **먼저 시작한 요청이 나중에 끝날 수 있다**. 그 응답을
  // 그대로 반영하면 이미 지나간 단계가 화면에 되살아난다. main 은 superseded 를 상태로 만들지
  // 않지만(`SettleOutcome`), renderer 도 자기 쪽 순서를 지켜야 한다.
  const requestSeq = useRef(0)
  const applyIfCurrent = useCallback((seq: number, next: ProviderStepInfo | null) => {
    if (seq === requestSeq.current) setStep(next)
  }, [])

  const login = useCallback(
    async (providerId: string, authKind?: ProviderAuthKind) => {
      const seq = ++requestSeq.current
      applyIfCurrent(
        seq,
        await providerApi.login({ providerId, ...(authKind ? { authKind } : {}) })
      )
    },
    [applyIfCurrent]
  )

  const submit = useCallback(
    async (providerId: string, input: Record<string, string>) => {
      const seq = ++requestSeq.current
      applyIfCurrent(seq, await providerApi.continue({ providerId, input }))
    },
    [applyIfCurrent]
  )

  const reauth = useCallback(
    async (providerId: string, authKind?: ProviderAuthKind) => {
      const seq = ++requestSeq.current
      applyIfCurrent(
        seq,
        await providerApi.reauth({ providerId, ...(authKind ? { authKind } : {}) })
      )
    },
    [applyIfCurrent]
  )

  const revoke = useCallback(async (providerId: string) => {
    // 해제는 진행 중이던 응답을 **전부 무효화한다** — 늦게 온 폼이 해제 후에 열리면 안 된다.
    const seq = ++requestSeq.current
    await providerApi.revoke({ providerId })
    if (seq === requestSeq.current) setStep(null)
  }, [])

  const clearStep = useCallback(() => {
    requestSeq.current += 1
    setStep(null)
  }, [])

  return { list, step, loading, login, submit, reauth, revoke, clearStep }
}
