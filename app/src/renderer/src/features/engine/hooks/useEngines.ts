import { useCallback, useEffect, useState } from 'react'
import type {
  AgentEnvironment,
  CreateEngineRequest,
  UpdateEngineRequest
} from '../../../../../shared/ipc'
import { engineApi } from '../../../shared/api/ipc'
import type { UiMessage } from '../../../shared/i18n'
import { refreshAgents, subscribeAgents, useAgentStore } from '../../../shared/stores/agentStore'

export interface EngineMutationState {
  busy: boolean
  // 카탈로그 키(폴백) 또는 예외 원문 — 렌더에서 uiMessageText 로 해석한다.
  error: UiMessage | null
}

export function useEngines(): {
  agents: AgentEnvironment[]
  state: EngineMutationState
  refresh: () => Promise<void>
  add: (req: CreateEngineRequest) => Promise<void>
  update: (req: UpdateEngineRequest) => Promise<void>
  remove: (key: string) => Promise<void>
  read: typeof engineApi.read
} {
  const agents = useAgentStore((store) => store.agents)
  const ensureLoaded = useAgentStore((store) => store.ensureLoaded)
  const [state, setState] = useState<EngineMutationState>({ busy: false, error: null })

  useEffect(() => subscribeAgents(), [])

  const mutate = useCallback(async (fn: () => Promise<unknown>): Promise<void> => {
    setState({ busy: true, error: null })
    try {
      await fn()
      await refreshAgents()
      setState({ busy: false, error: null })
    } catch (error) {
      const message: UiMessage =
        error instanceof Error ? { raw: error.message } : { key: 'errors.engineMutationFailed' }
      setState({ busy: false, error: message })
      throw error
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    await ensureLoaded()
  }, [ensureLoaded])

  return {
    agents,
    state,
    refresh,
    add: (req) => mutate(() => engineApi.add(req)),
    update: (req) => mutate(() => engineApi.update(req)),
    remove: (key) => mutate(() => engineApi.delete(key)),
    read: engineApi.read
  }
}
