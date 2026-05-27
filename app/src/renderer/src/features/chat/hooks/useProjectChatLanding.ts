import { useEffect, useRef } from 'react'
import { useChatContext } from '../providers/ChatProvider'

// 프로젝트 랜딩 화면의 채팅 라이프사이클을 관리. 진입 시 프로젝트용 새 채팅으로
// reset; 사용자가 메시지를 입력하거나 기존 세션을 클릭해 랜딩을 떠나야 하는 순간
// onActivity 콜백을 호출 (라우터가 chat 화면으로 전환).
//
// onActivity 는 ref 로 캡처해 deps 불안정성을 page 가 useCallback 으로 떠안지
// 않도록 한다 — page 는 인라인 화살표만으로 호출 가능.
export function useProjectChatLanding(projectId: string, onActivity: () => void): void {
  const chat = useChatContext()
  const initializedForRef = useRef<string | null>(null)
  const onActivityRef = useRef(onActivity)
  useEffect(() => {
    onActivityRef.current = onActivity
  })

  useEffect(() => {
    if (initializedForRef.current === projectId) {
      const isLanding =
        chat.state.messages.length === 0 &&
        chat.state.sessionId == null &&
        !chat.state.loadingSession
      if (!isLanding) onActivityRef.current()
      return
    }
    initializedForRef.current = projectId
    const alreadyLanding =
      chat.state.pendingProjectId === projectId &&
      chat.state.sessionId == null &&
      chat.state.messages.length === 0 &&
      !chat.state.loadingSession
    if (!alreadyLanding) chat.newChat(projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chat.state.messages.length, chat.state.sessionId, chat.state.loadingSession])
}
