import { create } from 'zustand'
import type { AgentEnvironment } from '../../../../shared/ipc'
import { agentApi } from '../api/ipc'
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
