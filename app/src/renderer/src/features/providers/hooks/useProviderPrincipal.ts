import { useEffect, useState } from 'react'
import type { ProviderPlatformState } from '../../../../../shared/ipc'
import { providerApi } from '../../../shared/api/ipc'
import { selectGatePrincipal } from '../lib/principal'

// 사이드바에 표시할 로그인 신원 (0182). `useProviderGate` 와 **같은 채널**(`orca:provider:state`)을
// 구독하므로 새 IPC 가 없다 — main 이 grant 변화마다 push 하니 초기 스냅샷 1회 + 구독이면 된다.
//
// 게이트 화면(`RootGate`)이 이미 같은 훅 패턴을 쓰지만 그쪽 상태를 프롭으로 내려보내지 않는다:
// 사이드바까지 관통시키면 `useSidebarSlots` 의 안정 identity(`useMemo([])`)가 깨져 `Sidebar`
// memo 가 매번 풀린다. 구독 하나가 더 붙는 비용이 그보다 싸다.
//
// **판정은 여기 없다** — 누구를 보여줄지는 `selectGatePrincipal`(순수·테스트 대상)이 정한다.
export function useProviderPrincipal(): string | null {
  const [principal, setPrincipal] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const absorb = (state: ProviderPlatformState): void => {
      if (!cancelled) setPrincipal(selectGatePrincipal(state.providers))
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

  return principal
}
