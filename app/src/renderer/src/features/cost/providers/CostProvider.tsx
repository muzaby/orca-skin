import { useEffect, type ReactNode } from 'react'
import { bootstrapCost } from '../store/costStore'

// cost 부트스트랩 호스트 — context value 를 제공하지 않는다(ChatProvider 와 동형).
// 상태는 Zustand costStore 가 담당한다 (handoff 0013 — Context 전파 모델 폐기).
export function CostProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => bootstrapCost(), [])
  return <>{children}</>
}
