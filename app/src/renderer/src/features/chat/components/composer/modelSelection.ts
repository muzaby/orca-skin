import type { AgentEnvironment, AgentModelView } from '../../../../../../shared/ipc'

export interface ModelSelection {
  providerKey: string
  modelFamily: string | null
  adapter: string
  provider?: string
}

export function modelKey(model: AgentModelView): string {
  return model.alias
}

export function defaultSelection(
  agents: AgentEnvironment[],
  sessionBackend: string | null
): ModelSelection | null {
  for (const agent of agents) {
    if (!agent.supported) continue
    if (sessionBackend && agent.adapter !== sessionBackend) continue
    const model = agent.models.find((m) => m.isDefault) ?? agent.models[0]
    return {
      providerKey: agent.key,
      modelFamily: model ? modelKey(model) : null,
      adapter: agent.adapter,
      provider: agent.provider
    }
  }
  return null
}

export function selectionLabel(selection: ModelSelection | null): string {
  if (!selection) return '모델'
  // adapter 제외 — provider 가 있으면 provider, 없으면 providerKey(=adapter 단독) 폴백.
  const left = selection.provider ?? selection.providerKey
  return selection.modelFamily ? `${left}/${selection.modelFamily}` : left
}
