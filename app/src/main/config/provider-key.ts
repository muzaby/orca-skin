import type { AgentEnvironment, AgentModelView, Backend } from '../../shared/ipc'
import { expandVars, type Resolver } from '../mcp/expand'
import type { OrcaAgentConfig, OrcaModelConfig } from './orca-file'

export interface SecretReader {
  get(name: string): string | undefined
}

export function providerKeyOf(agent: Pick<OrcaAgentConfig, 'adapter' | 'provider'>): string {
  const provider = agent.provider?.trim().toLowerCase()
  return provider ? `${agent.adapter}-${provider}` : agent.adapter
}

export function agentForProviderKey(
  agents: OrcaAgentConfig[],
  providerKey: string | null | undefined
): OrcaAgentConfig | undefined {
  if (!providerKey) return undefined
  return agents.find((agent) => providerKeyOf(agent) === providerKey)
}

export function dedupeAgents(
  agents: OrcaAgentConfig[],
  warn: (message: string) => void = () => {}
): OrcaAgentConfig[] {
  const seen = new Set<string>()
  const out: OrcaAgentConfig[] = []
  for (const agent of agents) {
    const key = providerKeyOf(agent)
    if (seen.has(key)) {
      warn(`provider key '${key}' 중복 — 두 번째 이후 agent 드롭`)
      continue
    }
    seen.add(key)
    out.push(agent)
  }
  return out
}

export function authTokenFor(
  agent: OrcaAgentConfig | undefined,
  options: { secretStore?: SecretReader; resolve: Resolver }
): string | undefined {
  if (!agent) return undefined
  const secret = options.secretStore?.get(`provider:${providerKeyOf(agent)}`)
  if (present(secret)) return secret
  if (!present(agent.authToken)) return undefined
  const missing = new Set<string>()
  const expanded = expandVars(agent.authToken!, options.resolve, missing)
  return missing.size === 0 && present(expanded) ? expanded : undefined
}

export function modelNameForFamily(
  agent: OrcaAgentConfig | undefined,
  family: string | null | undefined
): string | undefined {
  if (!agent || agent.models.length === 0) return undefined
  const wanted = family?.trim()
  const byFamily = wanted
    ? agent.models.find((model) => modelKey(model) === wanted || model.name === wanted)
    : undefined
  const selected = byFamily ?? agent.models.find((model) => model.default) ?? agent.models[0]
  return selected?.name
}

export function modelKey(model: OrcaModelConfig): string {
  return model.family ?? model.name
}

export function defaultModelFamily(agent: OrcaAgentConfig | undefined): string | null {
  if (!agent || agent.models.length === 0) return null
  const selected = agent.models.find((model) => model.default) ?? agent.models[0]
  return selected ? modelKey(selected) : null
}

export function toAgentEnvironments(
  agents: OrcaAgentConfig[],
  supportedAdapters: Iterable<string>
): AgentEnvironment[] {
  const supported = new Set(supportedAdapters)
  return agents.map((agent) => ({
    key: providerKeyOf(agent),
    adapter: agent.adapter as Backend,
    ...(present(agent.provider) ? { provider: agent.provider!.trim().toLowerCase() } : {}),
    supported: supported.has(agent.adapter),
    models: agent.models.map(
      (model): AgentModelView => ({
        name: model.name,
        ...(model.family ? { family: model.family } : {}),
        ...(model.default !== undefined ? { default: model.default } : {})
      })
    )
  }))
}

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== ''
}
