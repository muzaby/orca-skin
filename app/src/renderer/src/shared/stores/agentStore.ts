import { create } from 'zustand'
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

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: [],
  loading: false,
  error: null,
  loaded: false,
  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const agents = await agentApi.list()
      set({ agents, loaded: true, loading: false, error: null })
      return agents
    } catch (error) {
      const message: UiMessage =
        error instanceof Error ? { raw: error.message } : { key: 'errors.agentListFailed' }
      set({ agents: [], loaded: true, loading: false, error: message })
      return []
    }
  },
  ensureLoaded: async () => {
    const state = get()
    if (state.loaded || state.loading) return state.agents
    return state.refresh()
  }
}))

export const refreshAgents = (): Promise<AgentEnvironment[]> => useAgentStore.getState().refresh()

// **카탈로그 무효화 규칙은 store 의 것이다** (`usageStore.subscribeUsage` 선례) — provider 상태
// push 는 자동 등록/회수된 런타임 모델 행을 바꿀 수 있다. 소비처마다 구독을 다시 적으면
// 새 소비처가 조용히 낡은 목록을 보여준다.
export function subscribeAgents(): () => void {
  return providerApi.onState(() => void refreshAgents())
}
