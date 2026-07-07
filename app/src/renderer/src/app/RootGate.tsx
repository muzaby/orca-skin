import { useEffect } from 'react'
import { AppLayout } from './AppLayout'
import { LoginFrame } from './LoginFrame'
import { BootScreen } from './boot/BootScreen'
import { bootActions, useBootStore } from './boot/bootStore'
import { loginActions, useLoginStore } from '../features/login'

// 앱 최상위 게이트. 부팅 시 영속된 bypass 플래그를 읽어 로그인 게이트를 먼저 판정하고,
// 통과한 뒤 랜딩 진입 전 renderer 부트 오케스트레이터를 순차 실행한다.
export function RootGate(): React.JSX.Element | null {
  const hydrated = useLoginStore((s) => s.hydrated)
  const bypass = useLoginStore((s) => s.bypass)
  const authenticated = useLoginStore((s) => s.authenticated)
  const bootPhase = useBootStore((s) => s.phase)
  const bootError = useBootStore((s) => s.errorMessage)

  useEffect(() => {
    void loginActions.hydrateBypass()
  }, [])

  useEffect(() => {
    if (!hydrated || !(bypass || authenticated)) return
    if (bootPhase === 'idle') void bootActions.runBoot()
  }, [authenticated, bootPhase, bypass, hydrated])

  // 하이드레이트 전에는 렌더하지 않는다(ready-to-show 지연으로 flash 없음).
  if (!hydrated) return null
  if (!(bypass || authenticated)) return <LoginFrame />
  if (bootPhase === 'failed') {
    return <LoginFrame bootError={bootError} onRetryBoot={() => void bootActions.runBoot()} />
  }
  if (bootPhase === 'ready') return <AppLayout />
  return <BootScreen />
}
