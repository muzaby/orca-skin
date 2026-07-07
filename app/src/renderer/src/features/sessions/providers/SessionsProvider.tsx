import { useEffect, type ReactNode } from 'react'
import { subscribeSessions } from '../store/sessionsStore'

// sessions 부트스트랩 호스트 — context value 를 제공하지 않는다(ChatProvider 와 동형).
// 상태는 Zustand sessionsStore 가 담당한다 (handoff 0013 — Context 전파 모델 폐기).
export function SessionsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => subscribeSessions(), [])
  return <>{children}</>
}
