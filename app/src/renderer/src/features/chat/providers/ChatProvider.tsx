import { useEffect, type ReactNode } from 'react'
import { bootstrapChat } from '../store/chatStore'

// chat 부트스트랩 호스트 — context value 를 제공하지 않는다. 상태는 Zustand chatStore
// (selector 구독)가 담당하고, 여기서는 IPC 구독(chat 이벤트·세션 제목)과 cwd 1회 조회만
// 연결한다. context 가 없으므로 어떤 chat 이벤트도 이 서브트리 전체 재렌더를 유발하지
// 않는다 (state.md §1.4 — 구 Context+useReducer 전파 모델 폐기).
export function ChatProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => bootstrapChat(), [])
  return <>{children}</>
}
