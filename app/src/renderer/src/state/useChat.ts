import { useCallback, useEffect, useReducer } from 'react'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

export interface UseChat {
  state: ChatState
  send: (text: string) => void
  cancel: () => void
  newChat: () => void
  clearError: () => void
}

export function useChat(): UseChat {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)

  // 앱 부트 시 마지막 세션 ID 복원 (TRD §10 "재시작 재개"). 다음 사용자 턴에서
  // chat.send 가 이 sessionId 를 전달하면 어댑터가 resume 모드로 SDK 를 호출한다.
  useEffect(() => {
    void window.orca.settings.get().then((s) => {
      if (s.lastSessionId) {
        dispatch({ type: 'RESTORE_SESSION', sessionId: s.lastSessionId })
      }
    })
  }, [])

  useEffect(() => {
    const unsub = window.orca.chat.onEvent((ev) => {
      dispatch({ type: 'RECV_EVENT', event: ev })
      // 어댑터가 발급한 첫 sessionId 를 영속화. opencode 가 들어오면 lastBackend
      // 도 함께 갱신해야 한다 (OQ7).
      if (ev.type === 'init') {
        void window.orca.settings.set({
          lastSessionId: ev.data.sessionId,
          lastBackend: 'claude-code'
        })
      }
    })
    return unsub
  }, [])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (trimmed === '' || state.inflight) return
      dispatch({ type: 'SEND_USER_MESSAGE', text: trimmed })
      void window.orca.chat.send({ sessionId: state.sessionId, text: trimmed })
    },
    [state.sessionId, state.inflight]
  )

  const cancel = useCallback(() => {
    if (state.sessionId) void window.orca.chat.cancel(state.sessionId)
    dispatch({ type: 'CANCEL_CHAT' })
  }, [state.sessionId])

  const newChat = useCallback(() => {
    dispatch({ type: 'NEW_CHAT' })
    void window.orca.settings.set({ lastSessionId: null })
  }, [])
  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [])

  return { state, send, cancel, newChat, clearError }
}
