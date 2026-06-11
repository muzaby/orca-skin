import type { AgentEnvironment, AgentModelView } from '../../../../../../shared/ipc'

export interface ModelSelection {
  providerKey: string
  modelFamily: string | null
  adapter: string
}

export function modelKey(model: AgentModelView): string {
  return model.family ?? model.name
}

export function defaultSelection(
  agents: AgentEnvironment[],
  sessionBackend: string | null
): ModelSelection | null {
  for (const agent of agents) {
    if (!agent.supported) continue
    if (sessionBackend && agent.adapter !== sessionBackend) continue
    const model = agent.models.find((m) => m.default) ?? agent.models[0]
    return {
      providerKey: agent.key,
      modelFamily: model ? modelKey(model) : null,
      adapter: agent.adapter
    }
  }
  return null
}

export function selectionLabel(selection: ModelSelection | null): string {
  if (!selection) return '모델'
  return selection.modelFamily
    ? `${selection.providerKey}/${selection.modelFamily}`
    : selection.providerKey
}
