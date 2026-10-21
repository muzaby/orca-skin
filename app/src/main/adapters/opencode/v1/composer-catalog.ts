import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeComposerCatalog } from '../../../../shared/native-resources'

export async function openCodeComposerCatalog(
  client: OpencodeClient,
  directory: string,
  signal?: AbortSignal
): Promise<NativeComposerCatalog> {
  const timeout = AbortSignal.timeout(2500)
  const options = {
    throwOnError: true as const,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  }
  const [agents, providers] = await Promise.all([
    client.app.agents({ directory }, options),
    client.provider.list({ directory }, options)
  ])
  if (!agents.data || !providers.data) throw new Error('OpenCode Composer 목록을 읽지 못했습니다.')
  return {
    agents: agents.data
      .filter((agent) => !agent.hidden && agent.mode !== 'subagent')
      .map((agent) => ({
        name: agent.name,
        ...(agent.description ? { description: agent.description } : {}),
        ...(agent.model ? { model: `${agent.model.providerID}/${agent.model.modelID}` } : {}),
        ...(agent.variant ? { variant: agent.variant } : {})
      })),
    models: providers.data.all.flatMap((provider) =>
      Object.values(provider.models).map((model) => ({
        id: `${provider.id}/${model.id}`,
        variants: Object.entries(model.variants ?? {})
          .filter(([, value]) => value.disabled !== true)
          .map(([name]) => name)
      }))
    )
  }
}
