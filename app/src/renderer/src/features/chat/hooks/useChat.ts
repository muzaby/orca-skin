import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  chatReducer,
  initialChatState,
  type CachedSession,
  type ChatState
} from '../reducer/chatReducer'
import { askApi, chatApi, planApi, sessionApi, settingsApi } from '../../../shared/api/ipc'
import type { PermissionMode } from '../../../../../shared/ipc'

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
  // 외부에서 세션이 삭제됐을 때 chat-side 정리 — 캐시 invalidation + 활성 세션이면
  // 새 채팅으로 reset. project 컨텍스트가 있으면 그 프로젝트로 새 채팅을 시작.
  handleSessionDeleted: (sessionId: string, fallbackProjectId?: string | null) => void
  // AskUserQuestion 응답 — 사용자의 선택을 main(broker)으로 회신하고 카드를 큐에서 제거.
  answerAsk: (
    requestId: string,
    answers: Record<string, string | string[]>,
    response?: string
  ) => void
  // AskUserQuestion 건너뛰기 — main 이 deny 로 매핑해 Claude 가 스스로 진행.
  skipAsk: (requestId: string) => void
  // Composer 모드 버튼 — 이 대화의 권한 모드 선택 (계획 / 편집 수락).
  setPermissionMode: (mode: PermissionMode) => void
  // plan 모드 계획 카드 — 승인(실행) / 수정 제안(피드백 반영 재작성) / 거부(턴 중단).
  approvePlan: (requestId: string) => void
  revisePlan: (requestId: string, feedback: string) => void
  rejectPlan: (requestId: string) => void
  // 우측 계획 타일 — 헤더 토글 / 닫기 X / 분리선 드래그 폭 조절.
  togglePlanTile: () => void
  closePlanTile: () => void
  setPlanTileWidth: (width: number) => void
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
        void settingsApi.set({ lastSessionId: sessionId })
        return
      }

      dispatch({ type: 'START_LOAD_SESSION', sessionId, title })
      try {
        const session = await sessionApi.load(sessionId)
        if (!session) {
          dispatch({ type: 'LOAD_SESSION_ERROR' })
          void settingsApi.set({ lastSessionId: null })
          return
        }
        dispatch({ type: 'LOAD_SESSION', session })
        void settingsApi.set({ lastSessionId: session.id })
        // LOAD_SESSION 의 reducer 가 messages 를 재구성한 직후 effect 가 stateRef
        // 를 갱신 → 다음 loadSession 호출에서 캐시에 정확히 들어간다.
      } catch {
        dispatch({ type: 'LOAD_SESSION_ERROR' })
      }
    },
    [snapshotActiveToCache]
  )

  // 앱 부트 시 cwd 1회 조회 — init 이벤트가 오면 같은 값으로 덮어쓰기.
  // 마지막 세션 자동 복원은 BootRedirector(`/` → `/chat/<lastSessionId>`) + URL→State
  // 동기화(useChatRouteSync) 가 인계받았다 — 더 이상 여기서 loadSession 을 직접 부르지 않는다.
  useEffect(() => {
    void sessionApi.cwd().then((cwd) => {
      dispatch({ type: 'SET_CWD', cwd })
    })
  }, [])

  useEffect(() => {
    const unsub = chatApi.onEvent((ev) => {
      dispatch({ type: 'RECV_EVENT', event: ev })
      // 어댑터가 발급한 첫 sessionId 를 영속화. opencode 가 들어오면 lastBackend
      // 도 함께 갱신해야 한다 (OQ7).
      if (ev.type === 'init') {
        void settingsApi.set({
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
      void chatApi.send({
        sessionId: state.sessionId,
        projectId: state.sessionId ? null : state.pendingProjectId,
        text: trimmed,
        permissionMode: state.permissionMode
      })
    },
    [state.sessionId, state.inflight, state.pendingProjectId, state.permissionMode]
  )

  const cancel = useCallback(() => {
    if (state.sessionId) void chatApi.cancel(state.sessionId)
    dispatch({ type: 'CANCEL_CHAT' })
  }, [state.sessionId])

  const newChat = useCallback(
    (projectId: string | null = null) => {
      snapshotActiveToCache()
      dispatch({ type: 'NEW_CHAT', projectId })
      void settingsApi.set({ lastSessionId: null })
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

  const handleSessionDeleted = useCallback(
    (sessionId: string, fallbackProjectId?: string | null) => {
      cacheRef.current.delete(sessionId)
      if (stateRef.current.sessionId === sessionId) {
        dispatch({ type: 'NEW_CHAT', projectId: fallbackProjectId ?? null })
      }
    },
    []
  )

  const answerAsk = useCallback(
    (requestId: string, answers: Record<string, string | string[]>, response?: string): void => {
      void askApi.respond({
        requestId,
        type: 'answered',
        answers,
        ...(response !== undefined ? { response } : {})
      })
      dispatch({ type: 'RESOLVE_ASK', requestId })
    },
    []
  )

  const skipAsk = useCallback((requestId: string): void => {
    void askApi.respond({ requestId, type: 'skipped' })
    dispatch({ type: 'RESOLVE_ASK', requestId })
  }, [])

  const setPermissionMode = useCallback((mode: PermissionMode): void => {
    dispatch({ type: 'SET_PERMISSION_MODE', mode })
  }, [])

  const approvePlan = useCallback((requestId: string): void => {
    void planApi.respond({ requestId, type: 'approved' })
    dispatch({ type: 'RESOLVE_PLAN' })
    // 승인 = plan 모드 종료. 칩을 '편집 수락'으로 전환 → 다음 턴이 plan 모드로 재진입하지
    // 않아 ExitPlanMode 재호출(단순 질문 시 계획 카드 재출현)을 막는다.
    dispatch({ type: 'SET_PERMISSION_MODE', mode: 'acceptEdits' })
  }, [])

  const revisePlan = useCallback((requestId: string, feedback: string): void => {
    const trimmed = feedback.trim()
    if (trimmed === '') return
    void planApi.respond({ requestId, type: 'revise', feedback: trimmed })
    dispatch({ type: 'RESOLVE_PLAN' })
  }, [])

  const rejectPlan = useCallback((requestId: string): void => {
    void planApi.respond({ requestId, type: 'rejected' })
    // 거부는 턴 중단 — 카드 제거 + inflight 종료(main 이 turn abort, result 이벤트 없음).
    dispatch({ type: 'RESOLVE_PLAN' })
    dispatch({ type: 'CANCEL_CHAT' })
  }, [])

  const togglePlanTile = useCallback((): void => {
    dispatch({ type: 'TOGGLE_PLAN_TILE' })
  }, [])

  const closePlanTile = useCallback((): void => {
    dispatch({ type: 'SET_PLAN_TILE_OPEN', open: false })
  }, [])

  const setPlanTileWidth = useCallback((width: number): void => {
    dispatch({ type: 'SET_PLAN_TILE_WIDTH', width })
  }, [])

  return {
    state,
    send,
    cancel,
    newChat,
    clearError,
    loadSession,
    renameSession,
    invalidateSessionCache,
    handleSessionDeleted,
    answerAsk,
    skipAsk,
    setPermissionMode,
    approvePlan,
    revisePlan,
    rejectPlan,
    togglePlanTile,
    closePlanTile,
    setPlanTileWidth
  }
}
