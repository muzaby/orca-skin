import { useEffect } from 'react'
import { AppLayout } from './AppLayout'
import { LoginFrame } from './LoginFrame'
import { BootScreen } from './boot/BootScreen'
import { bootActions, useBootStore } from './boot/bootStore'
import { authActions, useAuthStore } from '../features/auth'

// 앱 최상위 게이트. 부팅 시 영속된 bypass 플래그 + main SSO 상태를 하이드레이트해 로그인
// 게이트를 먼저 판정하고, 통과한 뒤 랜딩 진입 전 renderer 부트 오케스트레이터를 순차 실행한다.
// 게이트 활성 조건(0130): DEV 는 항상(디버그 bypass 로 통과 — handoff 0089 유지), prod 는
// main 에 SSO 모듈이 등록된 폐쇄망 배포(`required`)에서만 — 모듈 0개 prod 는 현행처럼 게이트
// 없이 바로 부트로 진행한다. import.meta.env.DEV 를 사용처에서 직접 써야 Vite 가 prod 분기를
// 정적 제거한다(모듈 경계를 넘는 상수는 폴드되지 않음).
export function RootGate(): React.JSX.Element | null {
  const hydrated = useAuthStore((s) => s.hydrated)
  const bypass = useAuthStore((s) => s.bypass)
  const required = useAuthStore((s) => s.required)
  const authenticated = useAuthStore((s) => s.authenticated)
  const bootPhase = useBootStore((s) => s.phase)
  const bootError = useBootStore((s) => s.errorMessage)
  const gatePassed = import.meta.env.DEV ? bypass || authenticated : !required || authenticated

  useEffect(() => {
    void authActions.hydrate()
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
