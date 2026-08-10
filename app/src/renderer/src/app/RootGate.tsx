import { useEffect } from 'react'
import { AppLayout } from './AppLayout'
import { BootFailureFrame } from './BootFailureFrame'
import { BootScreen } from './boot/BootScreen'
import { bootActions, useBootStore } from './boot/bootStore'

// 앱 최상위 게이트. renderer 부트 오케스트레이터를 실행하고 그 단계에 따라 화면을 고른다.
//
// 0180 에서 로그인 게이트가 사라졌다 — 인증 하이드레이트를 기다리는 단계가 없으므로
// 부팅이 곧 최상위 상태다. 게이트는 0181 이 `Provider{kind:'gate'}` 로 다시 세운다.
export function RootGate(): React.JSX.Element {
  const bootPhase = useBootStore((s) => s.phase)
  const bootError = useBootStore((s) => s.errorMessage)

  useEffect(() => {
    if (bootPhase === 'idle') void bootActions.runBoot()
  }, [bootPhase])

  if (bootPhase === 'failed') {
    return <BootFailureFrame bootError={bootError} onRetryBoot={() => void bootActions.runBoot()} />
  }
  if (bootPhase === 'ready') return <AppLayout />
  return <BootScreen />
}
