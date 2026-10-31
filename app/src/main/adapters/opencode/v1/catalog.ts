import type { AgentEnvironment } from '../../../../shared/ipc'
import { isRecord } from '../../../../shared/obj'
import { OPENCODE_DEFAULT_AGENTS } from '../../../../shared/harness'
import { parseOpenCodeModels } from './settings'

export function openCodeCatalog(
  entry: AgentEnvironment,
  config: Record<string, unknown>
): AgentEnvironment {
  const agents: Record<string, unknown> = {
    ...Object.fromEntries(OPENCODE_DEFAULT_AGENTS.map((name) => [name, { mode: 'primary' }])),
    ...(isRecord(config.agent) ? config.agent : {})
  }
  return {
    ...entry,
    // runtime 행(0291)의 모델은 호스트 연결 결과가 정본이다 — settings 로 다시 계산하지 않는다.
    models: entry.source === 'runtime' ? entry.models : parseOpenCodeModels(config),
    agents: Object.entries(agents).flatMap(([name, value]) => {
      if (!isRecord(value) || value.hidden || value.disable || value.mode === 'subagent') return []
      return [
        {
          name,
          ...(typeof value.description === 'string' ? { description: value.description } : {})
        }
      ]
    })
  }
}
