import { useEffect, useRef } from 'react'
import { useChatContext } from '../../features/chat'
import { useSessionsContext } from '../../features/sessions'

// 채팅 턴 완료 (inflight: true → false 전이) 시 사이드바 세션 목록을 자동 갱신.
// cross-feature effect 라 셸이 호스트한다 (features/ 끼리는 직접 결합 못함).
export function useChatSessionsSync(): void {
  const chat = useChatContext()
  const sessionsCtx = useSessionsContext()
  const wasInflightRef = useRef(false)
  useEffect(() => {
    if (wasInflightRef.current && !chat.state.inflight) void sessionsCtx.refresh()
    wasInflightRef.current = chat.state.inflight
  }, [chat.state.inflight, sessionsCtx])
}
