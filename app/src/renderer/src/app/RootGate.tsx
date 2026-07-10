import { useEffect } from 'react'
import { AppLayout } from './AppLayout'
import { LoginFrame } from './LoginFrame'
import { BootScreen } from './boot/BootScreen'
import { bootActions, useBootStore } from './boot/bootStore'
import { loginActions, useLoginStore } from '../features/login'

// 앱 최상위 게이트. 부팅 시 영속된 bypass 플래그를 읽어 로그인 게이트를 먼저 판정하고,
// 통과한 뒤 랜딩 진입 전 renderer 부트 오케스트레이터를 순차 실행한다.
// 로그인 게이트는 dev 전용(handoff 0089) — 배포(prod) 빌드에는 SSO 실구현이 없고 디버그
// 패널(bypass 토글)도 제거되어 통과 수단이 없으므로 게이트를 끄고 바로 부트로 진행한다.
// import.meta.env.DEV 를 사용처에서 직접 써야 Vite 가 prod 분기를 정적 제거한다(모듈 경계
// 를 넘는 상수는 폴드되지 않음). 실 SSO 배선 시 이 가드를 제거해 게이트를 상시 활성으로.
export function RootGate(): React.JSX.Element | null {
  const hydrated = useLoginStore((s) => s.hydrated)
  const bypass = useLoginStore((s) => s.bypass)
  const authenticated = useLoginStore((s) => s.authenticated)
  const bootPhase = useBootStore((s) => s.phase)
  const bootError = useBootStore((s) => s.errorMessage)
  const gatePassed = !import.meta.env.DEV || bypass || authenticated

  useEffect(() => {
    void loginActions.hydrateBypass()
  }, [])

  useEffect(() => {
    if (!hydrated || !gatePassed) return
    if (bootPhase === 'idle') void bootActions.runBoot()
  }, [bootPhase, gatePassed, hydrated])

  // 하이드레이트 전에는 렌더하지 않는다(ready-to-show 지연으로 flash 없음).
  if (!hydrated) return null
  if (!gatePassed) return <LoginFrame />
  if (bootPhase === 'failed') {
    return <LoginFrame bootError={bootError} onRetryBoot={() => void bootActions.runBoot()} />
  }
  if (bootPhase === 'ready') return <AppLayout />
  return <BootScreen />
}
