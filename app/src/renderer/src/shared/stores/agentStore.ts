import { create } from 'zustand'
import type { AgentEnvironment } from '../../../../shared/ipc'
import { agentApi } from '../api/ipc'

interface AgentStoreState {
  agents: AgentEnvironment[]
  loading: boolean
  error: string | null
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
      const message = error instanceof Error ? error.message : 'agent 목록을 불러오지 못했습니다'
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
