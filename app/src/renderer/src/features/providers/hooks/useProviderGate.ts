import { useCallback, useEffect, useState } from 'react'
import type {
  ProviderAuthKind,
  ProviderGateState,
  ProviderInfo,
  ProviderPlatformState,
  ProviderStepInfo
} from '../../../../../shared/ipc'
import { providerApi } from '../../../shared/api/ipc'

export interface UseProviderGate {
  // 판정 전(첫 invoke 응답 대기)에는 null — 게이트를 통과시키지도, 화면을 띄우지도 않는다.
  gate: ProviderGateState | null
  // 게이트 통과 후 나머지 Auth 의 부팅 복원이 진행 중인가 (0194).
  resuming: boolean
  // 게이트 대상(`kind:'gate'`)만.
  providers: ProviderInfo[]
  step: ProviderStepInfo | null
  busy: boolean
  login: (providerId: string, authKind?: ProviderAuthKind) => Promise<void>
  submit: (providerId: string, input: Record<string, string>) => Promise<void>
}

// 로그인 게이트 상태. main 이 grant 변화마다 push 하므로 초기 스냅샷 1회 + 구독이면 된다.
//
// **invoke 실패를 `required:false` 로 기본화하지 않는다.** 그렇게 하면 main 이 잠깐 응답하지
// 못하는 사이 로그인 강제 빌드가 무인증으로 열린다 — 판정 전에는 `gate` 를 null 로 두고
// 호출부가 부팅 화면을 유지한다(fail-closed).
export function useProviderGate(): UseProviderGate {
  const [state, setState] = useState<ProviderPlatformState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const absorb = (next: ProviderPlatformState): void => {
      if (!cancelled) setState(next)
    }
    providerApi
      .state()
      .then(absorb)
      .catch(() => undefined)
    const off = providerApi.onState(absorb)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const run = useCallback(async (action: () => Promise<ProviderStepInfo>) => {
    setBusy(true)
    try {
      const step = await action()
      setState((current) => (current ? { ...current, step } : current))
    } finally {
      setBusy(false)
    }
  }, [])

  const login = useCallback(
    (providerId: string, authKind?: ProviderAuthKind) =>
      run(() => providerApi.login({ providerId, ...(authKind ? { authKind } : {}) })),
    [run]
  )

  const submit = useCallback(
    (providerId: string, input: Record<string, string>) =>
      run(() => providerApi.continue({ providerId, input })),
    [run]
  )

  return {
    gate: state?.gate ?? null,
    // 미판정(`state === null`)이면 false 로 둔다 — 그 경우 `gate` 도 null 이라 호출부가 어차피
    // 대기 화면을 유지한다(fail-closed 는 `gate` 축이 갖는다).
    resuming: state?.resuming ?? false,
    providers: (state?.providers ?? []).filter((provider) => provider.kind === 'gate'),
    step: state?.step ?? null,
    busy,
    login,
    submit
  }
}
