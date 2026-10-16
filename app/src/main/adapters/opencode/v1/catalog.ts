import type { AgentEnvironment } from '../../../../shared/ipc'
import { isRecord } from '../../../../shared/obj'
import { parseOpenCodeModels } from './settings'

export function openCodeCatalog(
  entry: AgentEnvironment,
  config: Record<string, unknown>
): AgentEnvironment {
  const agents: Record<string, unknown> = {
    build: { mode: 'primary' },
    plan: { mode: 'primary' },
    ...(isRecord(config.agent) ? config.agent : {})
  }
  return {
    ...entry,
    models: parseOpenCodeModels(config),
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
