import { useCallback, useEffect, useReducer } from 'react'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'

export interface UseChat {
  state: ChatState
  send: (text: string) => void
  cancel: () => void
  newChat: () => void
  clearError: () => void
  loadSession: (sessionId: string) => Promise<void>
}

export function useChat(): UseChat {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)

  // 앱 부트 시 마지막 세션의 메시지를 비동기 로드 (TRD §10 "재시작 재개"). 부팅 흐름:
  // (1) settings.lastSessionId 조회 → (2) START_LOAD_SESSION 으로 인디케이터 켜기 →
  // (3) session.load IPC → (4) LOAD_SESSION 으로 메시지 교체. DB 에 row 가 없으면
  // (예: 사용자 데이터 폴더 삭제 후 lastSessionId 만 남은 경우) LOAD_SESSION_ERROR 로
  // 빈 ChatPane 으로 fallback + lastSessionId 정리.
  useEffect(() => {
    void window.orca.settings.get().then((s) => {
      if (!s.lastSessionId) return
      const sid = s.lastSessionId
      dispatch({ type: 'START_LOAD_SESSION', sessionId: sid })
      void window.orca.session
        .load(sid)
        .then((session) => {
          if (session) {
            dispatch({ type: 'LOAD_SESSION', session })
          } else {
            dispatch({ type: 'LOAD_SESSION_ERROR' })
            void window.orca.settings.set({ lastSessionId: null })
          }
        })
        .catch(() => {
          dispatch({ type: 'LOAD_SESSION_ERROR' })
        })
    })
    // 세션 init 이벤트 전에도 cwd 를 알 수 있도록 부팅 시 1회 조회. main 의
    // defaultCwd 와 동일 — init 이 오면 같은 값으로 덮어쓰기.
    void window.orca.session.cwd().then((cwd) => {
      dispatch({ type: 'SET_CWD', cwd })
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

  // 사이드바 항목 클릭 시 호출. 낙관적으로 인디케이터를 먼저 켜고 IPC 응답을 기다린다.
  // 실패 (DB row 없음 / IPC 에러) 시 빈 ChatPane 으로 fallback.
  const loadSession = useCallback(async (sessionId: string) => {
    dispatch({ type: 'START_LOAD_SESSION', sessionId })
    try {
      const session = await window.orca.session.load(sessionId)
      if (!session) {
        dispatch({ type: 'LOAD_SESSION_ERROR' })
        return
      }
      dispatch({ type: 'LOAD_SESSION', session })
      void window.orca.settings.set({ lastSessionId: session.id })
    } catch {
      dispatch({ type: 'LOAD_SESSION_ERROR' })
    }
  }, [])

  return { state, send, cancel, newChat, clearError, loadSession }
}
