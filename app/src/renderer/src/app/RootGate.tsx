import { useEffect } from 'react'
import { AppLayout } from './AppLayout'
import { LoginFrame } from './LoginFrame'
import { loginActions, useLoginStore } from '../features/login'

// 앱 최상위 게이트. 부팅 시 영속된 bypass 플래그를 읽어, 로그인 화면(LoginFrame)과
// 일반 셸(AppLayout) 중 무엇을 렌더할지 결정한다. bypass 는 store 에 있으므로 디버그
// 패널 토글에 즉시 반응하고, authenticated 는 인메모리라 매 실행 로그인부터 시작한다.
export function RootGate(): React.JSX.Element | null {
  const hydrated = useLoginStore((s) => s.hydrated)
  const bypass = useLoginStore((s) => s.bypass)
  const authenticated = useLoginStore((s) => s.authenticated)

  useEffect(() => {
    void loginActions.hydrateBypass()
  }, [])

  // 하이드레이트 전에는 렌더하지 않는다(ready-to-show 지연으로 flash 없음).
  if (!hydrated) return null
  if (bypass || authenticated) return <AppLayout />
  return <LoginFrame />
}
