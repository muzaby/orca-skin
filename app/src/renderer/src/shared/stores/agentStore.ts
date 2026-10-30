import { reportError } from '../errors'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { AgentEnvironment } from '../../../../shared/ipc'
import { agentApi, providerApi } from '../api/ipc'
import type { UiMessage } from '../i18n'

interface AgentStoreState {
  agents: AgentEnvironment[]
  loading: boolean
  // 카탈로그 키(폴백) 또는 예외 원문 — 표시 시 uiMessageText 로 해석한다.
  error: UiMessage | null
  loaded: boolean
  refresh: () => Promise<AgentEnvironment[]>
  ensureLoaded: () => Promise<AgentEnvironment[]>
}

export interface AgentStoreDeps {
  list: () => Promise<AgentEnvironment[]>
  // provider 상태 push 구독. 해제 함수는 쓰지 않는다 — 앱 수명 동안 유지한다.
  subscribe: (handler: () => void) => unknown
}

// **카탈로그 무효화 규칙은 store 의 것이다** — provider 상태 push 는 자동 등록/회수된 런타임
// 모델 행을 바꿀 수 있다. 구독을 화면 마운트에 묶으면 화면이 없는 동안 온 push 를 놓치고,
// 다음 진입은 `ensureLoaded` 의 캐시를 그대로 보여 준다(0291 D-021). 그래서 첫 읽기 때
// 앱 수명 구독을 한 번만 설치한다.
//
// **늦게 도착한 응답은 버린다.** push 가 연달아 오면 이전 `agent:list` 가 나중에 끝날 수 있다 —
// 단조 seq 로 마지막으로 시작한 요청의 결과만 반영한다.
export function createAgentStore(deps: AgentStoreDeps): UseBoundStore<StoreApi<AgentStoreState>> {
  let subscribed = false
  let seq = 0
  return create<AgentStoreState>((set, get) => {
    const ensureSubscribed = (): void => {
      if (subscribed) return
      subscribed = true
      deps.subscribe(() => void get().refresh())
    }
    return {
      agents: [],
      loading: false,
      error: null,
      loaded: false,
      refresh: async () => {
        ensureSubscribed()
        const mine = ++seq
        set({ loading: true, error: null })
        try {
          const agents = await deps.list()
          if (mine !== seq) return get().agents
          set({ agents, loaded: true, loading: false, error: null })
          return agents
        } catch (error) {
          if (mine !== seq) return get().agents
          const message: UiMessage =
            error instanceof Error ? { raw: error.message } : { key: 'errors.agentListFailed' }
          set({ agents: [], loaded: true, loading: false, error: message })
          reportError({
            event: 'agents.list.load-failed',
            scope: 'agents',
            title: 'loadFailed',
            error: error
          })
          return []
        }
      },
      ensureLoaded: async () => {
        ensureSubscribed()
        const state = get()
        if (state.loaded || state.loading) return state.agents
        return state.refresh()
      }
    }
  })
}

export const useAgentStore = createAgentStore({
  list: () => agentApi.list(),
  subscribe: (handler) => providerApi.onState(handler)
})

export const refreshAgents = (): Promise<AgentEnvironment[]> => useAgentStore.getState().refresh()
