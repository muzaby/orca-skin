import type { AgentEnvironment } from '../../../../../../../shared/ipc'

export function resolveAgentSelection(
  selected: string | undefined,
  agents: AgentEnvironment['agents'],
  authoritative: boolean,
  status?: 'loading' | 'ready' | 'error'
): string {
  if (!authoritative || status === 'loading' || status === 'error') return selected ?? ''
  return agents?.some((agent) => agent.name === selected) ? selected! : (agents?.[0]?.name ?? '')
}
