import { useEffect, type ReactNode } from 'react'
import { subscribeProjects } from '../store/projectsStore'

// projects 부트스트랩 호스트 — context value 를 제공하지 않는다(ChatProvider 와 동형).
// 상태는 Zustand projectsStore 가 담당한다 (handoff 0013 — Context 전파 모델 폐기).
export function ProjectsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => subscribeProjects(), [])
  return <>{children}</>
}
