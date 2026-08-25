import type { AgentEnvironment, AgentModelView } from '../../../../../../shared/ipc'

export interface ModelSelection {
  providerKey: string
  modelFamily: string | null
  adapter: string
  provider?: string
}

export function modelKey(model: AgentModelView): string {
  return model.model ?? model.alias
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

// 선택이 아직 카탈로그에 있는가 — adapter 는 판정에 참여하지 않으므로 받지 않는다
// (`modelFamily == null` 은 default hydration 대기 중이라 provider 존재만 본다).
export function selectionExists(
  agents: AgentEnvironment[],
  providerKey: string,
  modelFamily: string | null
): boolean {
  return agents.some(
    (agent) =>
      agent.key === providerKey &&
      (modelFamily == null || agent.models.some((model) => modelKey(model) === modelFamily))
  )
}

// 선택 없음(null)이면 null — '모델' 폴백 라벨은 렌더(Composer)가 tr 로 채운다(0097).
export function selectionLabel(selection: ModelSelection | null): string | null {
  if (!selection) return null
  // adapter 제외 — provider 가 있으면 provider, 없으면 providerKey(=adapter 단독) 폴백.
  const left = selection.provider ?? selection.providerKey
  return selection.modelFamily ? `${left}/${selection.modelFamily}` : left
}
