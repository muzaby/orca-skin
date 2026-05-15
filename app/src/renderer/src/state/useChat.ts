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

  useEffect(() => {
    const unsub = window.orca.chat.onEvent((ev) => {
      dispatch({ type: 'RECV_EVENT', event: ev })
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

  const newChat = useCallback(() => dispatch({ type: 'NEW_CHAT' }), [])
  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [])

  return { state, send, cancel, newChat, clearError }
}
