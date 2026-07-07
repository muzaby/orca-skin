import { Navigate } from 'react-router-dom'
import { useBootStore } from './boot/bootStore'

// `/` 라우트의 element. 랜딩 타겟은 RootGate 의 부트 오케스트레이터가 이미 결정한다.
// 이후 `/` 는 URL 에 등장하지 않으며, 세션 복원은 URL → State 동기화
// (useChatRouteSync) 가 일반 경로로 흡수한다.
export function BootRedirector(): React.JSX.Element {
  const target = useBootStore((s) => s.landingTarget)
  return <Navigate to={target ?? '/new'} replace />
}
