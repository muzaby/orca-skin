import { useEffect, type ReactNode } from 'react'
import { subscribeUsage } from '../../../shared/stores/usageStore'

// 사용량 부트스트랩 호스트 — context value 를 제공하지 않는다(ChatProvider 와 동형).
// 상태는 Zustand usageStore 가 담당한다 (handoff 0013 — Context 전파 모델 폐기).
//
// 파일은 작지만 책임이 명확하다: **구독 라이프사이클**(마운트 시 구독, 언마운트 시 해제).
// 이걸 없애려고 부팅 초기화에 섞으면 재시도·이중 구독·정리 계약을 다시 설계해야 한다.
export function CostProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => subscribeUsage(), [])
  return <>{children}</>
}
