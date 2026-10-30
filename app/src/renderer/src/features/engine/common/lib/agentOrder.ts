import { HARNESS_IDS } from '../../../../../../shared/harness'
import type { AgentEnvironment } from '../../../../../../shared/ipc'

// 엔진&모델 카드 순서(0291 D-018) — `HARNESS_IDS` 순(Claude → OpenCode), 모르는 adapter 는 뒤.
// 같은 하네스 안에서는 입력 순서를 지킨다(안정 정렬).
export function orderAgentEnvironments<T extends Pick<AgentEnvironment, 'adapter'>>(
  agents: readonly T[]
): T[] {
  const rank = (adapter: string): number => {
    const index = HARNESS_IDS.findIndex((id) => id === adapter)
    return index < 0 ? HARNESS_IDS.length : index
  }
  return agents
    .map((agent, index) => ({ agent, index, rank: rank(agent.adapter) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.agent)
}
