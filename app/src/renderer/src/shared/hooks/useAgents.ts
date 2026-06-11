import { useEffect, useState } from 'react'
import type { AgentEnvironment } from '../../../../shared/ipc'
import { agentApi } from '../api/ipc'

// 부팅 시 main 의 orca.json agent 환경 목록을 한 번 로드한다. hot-reload 는 후속 범위.
export function useAgents(): AgentEnvironment[] {
  const [agents, setAgents] = useState<AgentEnvironment[]>([])
  useEffect(() => {
    agentApi
      .list()
      .then(setAgents)
      .catch(() => setAgents([]))
  }, [])
  return agents
}
