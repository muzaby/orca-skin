import { useEffect } from 'react'
import type { AgentEnvironment } from '../../../../shared/ipc'
import { refreshAgents, useAgentStore } from '../stores/agentStore'
import { providerApi } from '../api/ipc'

export function useAgents(): AgentEnvironment[] {
  const agents = useAgentStore((state) => state.agents)
  const ensureLoaded = useAgentStore((state) => state.ensureLoaded)

  useEffect(() => {
    void ensureLoaded()
    const off = providerApi.onState(() => void refreshAgents())
    return off
  }, [ensureLoaded])

  return agents
}
