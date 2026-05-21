import { useCallback, useEffect, useReducer, useRef } from 'react'
import { chatReducer, initialChatState, type CachedSession, type ChatState } from './chatReducer'

export interface UseChat {
  state: ChatState
  send: (text: string) => void
  cancel: () => void
  // projectId 를 전달하면 새 세션이 해당 프로젝트에 binding 된다. ProjectDetail 진입 시 사용.
  newChat: (projectId?: string | null) => void
  clearError: () => void
  // title 은 사이드바 메타에서 가져오는 낙관적 값. 부팅 자동 복원처럼 메타가 아직
  // 없는 경로에서는 생략 — 도착한 LoadedSession.title 로 채워진다.
  loadSession: (sessionId: string, title?: string | null) => Promise<void>
  // 활성 세션 / 캐시 entry 의 title 동시 갱신 (DB flush 는 useSessions 가 담당).
  renameSession: (sessionId: string, title: string) => void
  // 세션 삭제 등으로 캐시 entry 를 비울 때.
  invalidateSessionCache: (sessionId: string) => void
}

export function useChat(): UseChat {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)

  // useCallback 안에서 latest state 를 참조하기 위한 ref. deps 폭주를 피하면서
  // "다른 세션으로 전환할 때 현재 활성 세션의 snapshot 을 캐시에 저장" 같은 패턴을
  // 안전하게 표현한다.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  // 같은 윈도우 안에서 본 적 있는 세션의 (title, messages) snapshot. unbounded —
  // 단일 사용자·단일 윈도우라 수십 entry 이내. LRU 도입은 Phase 4.
  const cacheRef = useRef<Map<string, CachedSession>>(new Map())

  // 활성 세션을 떠날 때 호출. messages 가 비어 있으면 (loading 중 또는 빈 세션)
  // 의미 있는 snapshot 이 아니므로 skip.
  const snapshotActiveToCache = useCallback((): void => {
    const cur = stateRef.current
    if (!cur.sessionId || cur.loadingSession || cur.messages.length === 0) return
    cacheRef.current.set(cur.sessionId, {
      title: cur.title,
      messages: cur.messages
    })
  }, [])

  // 사이드바 항목 클릭 / 부팅 자동 복원 공통. 캐시 hit 면 IPC 생략, miss 면 IPC.
  // 같은 세션을 다시 클릭하는 경우는 no-op (불필요한 reset 방지).
  const loadSession = useCallback(
    async (sessionId: string, title: string | null = null) => {
      if (stateRef.current.sessionId === sessionId && !stateRef.current.loadingSession) return

      snapshotActiveToCache()

      const cached = cacheRef.current.get(sessionId)
      if (cached) {
        dispatch({ type: 'LOAD_SESSION_FROM_CACHE', sessionId, cached })
        void window.orca.settings.set({ lastSessionId: sessionId })
        return
      }

      dispatch({ type: 'START_LOAD_SESSION', sessionId, title })
      try {
        const session = await window.orca.session.load(sessionId)
        if (!session) {
          dispatch({ type: 'LOAD_SESSION_ERROR' })
          void window.orca.settings.set({ lastSessionId: null })
          return
        }
        dispatch({ type: 'LOAD_SESSION', session })
        void window.orca.settings.set({ lastSessionId: session.id })
        // LOAD_SESSION 의 reducer 가 messages 를 재구성한 직후 effect 가 stateRef
        // 를 갱신 → 다음 loadSession 호출에서 캐시에 정확히 들어간다.
      } catch {
        dispatch({ type: 'LOAD_SESSION_ERROR' })
      }
    },
    [snapshotActiveToCache]
  )

  // 앱 부트 시 마지막 세션 자동 복원 (TRD §10 "재시작 재개").
  useEffect(() => {
    void window.orca.settings.get().then((s) => {
      if (s.lastSessionId) void loadSession(s.lastSessionId)
    })
    // 세션 init 이벤트 전에도 cwd 를 알 수 있도록 부팅 시 1회 조회. main 의
    // defaultCwd 와 동일 — init 이 오면 같은 값으로 덮어쓰기.
    void window.orca.session.cwd().then((cwd) => {
      dispatch({ type: 'SET_CWD', cwd })
    })
  }, [loadSession])

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
      // 새 채팅 (sessionId=null) 첫 메시지일 때만 projectId 전달. resume 경로면 main 이
      // sessionId 로부터 직접 project_id 를 조회하므로 여기서는 null.
      void window.orca.chat.send({
        sessionId: state.sessionId,
        projectId: state.sessionId ? null : state.pendingProjectId,
        text: trimmed
      })
    },
    [state.sessionId, state.inflight, state.pendingProjectId]
  )

  const cancel = useCallback(() => {
    if (state.sessionId) void window.orca.chat.cancel(state.sessionId)
    dispatch({ type: 'CANCEL_CHAT' })
  }, [state.sessionId])

  const newChat = useCallback(
    (projectId: string | null = null) => {
      snapshotActiveToCache()
      dispatch({ type: 'NEW_CHAT', projectId })
      void window.orca.settings.set({ lastSessionId: null })
    },
    [snapshotActiveToCache]
  )

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), [])

  // 활성 세션의 reducer state.title 과 메모리 캐시 entry 만 동기화. DB flush 는
  // useSessions.rename 이 담당 — App.tsx 가 두 함수를 모두 호출한다.
  const renameSession = useCallback((sessionId: string, title: string): void => {
    const trimmed = title.trim()
    if (trimmed === '') return
    const cached = cacheRef.current.get(sessionId)
    if (cached) cacheRef.current.set(sessionId, { ...cached, title: trimmed })
    dispatch({ type: 'RENAME_SESSION', sessionId, title: trimmed })
  }, [])

  const invalidateSessionCache = useCallback((sessionId: string) => {
    cacheRef.current.delete(sessionId)
  }, [])

  return {
    state,
    send,
    cancel,
    newChat,
    clearError,
    loadSession,
    renameSession,
    invalidateSessionCache
  }
}
