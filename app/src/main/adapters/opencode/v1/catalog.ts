import type { AgentEnvironment } from '../../../../shared/ipc'
import type { Agent, Provider } from '@opencode-ai/sdk/v2'

export function openCodeCatalog(
  entry: AgentEnvironment,
  providers: Provider[],
  agents: Agent[],
  defaults: Record<string, string>
): AgentEnvironment {
  return {
    ...entry,
    agents: agents
      .filter((agent) => !agent.hidden && agent.mode !== 'subagent')
      .map((agent) => ({
        name: agent.name,
        ...(agent.description ? { description: agent.description } : {})
      })),
    models: providers.flatMap((provider) =>
      Object.values(provider.models).map((model) => ({
        alias: model.name,
        model: `${provider.id}/${model.id}`,
        providerId: provider.id,
        isCustom: true,
        oneMillionContext: false,
        isDefault: defaults[provider.id] === model.id,
        variants: Object.entries(model.variants ?? {})
          .filter(([, variant]) => variant.disabled !== true)
          .map(([name]) => name)
      }))
    )
  }
}
