import type { AgentEnvironment } from '../../../../../../../shared/ipc'
import { OPENCODE_DEFAULT_AGENTS } from '../../../../../../../shared/harness'

// authoritative 목록이 오기 전(로딩·오류)에 메뉴를 비우지 않는 자리표시 목록(0291 D-016).
// 선택 provider 행의 `agents`(settings 기반 primary)를 쓰고, 행이 없으면 공용 기본값이다.
// 전송 선택으로 저장하지 않는다 — 표시 전용이다.
export function agentPlaceholder(
  providerKey: string | null,
  environments: readonly AgentEnvironment[]
): NonNullable<AgentEnvironment['agents']> {
  const fromCatalog = environments.find((entry) => entry.key === providerKey)?.agents
  if (fromCatalog && fromCatalog.length > 0) return fromCatalog
  return OPENCODE_DEFAULT_AGENTS.map((name) => ({ name }))
}

export function resolveAgentSelection(
  selected: string | undefined,
  agents: AgentEnvironment['agents'],
  authoritative: boolean,
  status?: 'loading' | 'ready' | 'error'
): string {
  if (!authoritative || status === 'loading' || status === 'error') return selected ?? ''
  return agents?.some((agent) => agent.name === selected) ? selected! : (agents?.[0]?.name ?? '')
}
