import { useEffect, type ReactNode } from 'react'
import { bootstrapBackend } from '../store/backendStore'

// backend 부트스트랩 호스트 — context value 를 제공하지 않는다(ChatProvider 와 동형).
// 상태는 Zustand backendStore(selector 구독)가 담당하고, 여기서는 부팅 1회 설치 상태
// 조회 + 미설치 시 인스톨러 자동 오픈만 연결한다 (handoff 0013 — Context 전파 모델 폐기).
export function BackendProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => bootstrapBackend(), [])
  return <>{children}</>
}
