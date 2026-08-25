import { useEffect } from 'react'
import type { AgentEnvironment } from '../../../../shared/ipc'
import { subscribeAgents, useAgentStore } from '../stores/agentStore'

export function useAgents(): AgentEnvironment[] {
  const agents = useAgentStore((state) => state.agents)
  const ensureLoaded = useAgentStore((state) => state.ensureLoaded)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])
  useEffect(() => subscribeAgents(), [])

  return agents
}
