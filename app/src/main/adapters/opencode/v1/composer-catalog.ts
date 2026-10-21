import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeComposerCatalog } from '../../../../shared/native-resources'

export async function openCodeComposerAgents(
  client: OpencodeClient,
  directory: string,
  signal?: AbortSignal
): Promise<NativeComposerCatalog['agents']> {
  const options = {
    throwOnError: true as const,
    signal
  }
  const agents = await client.app.agents({ directory }, options)
  if (!agents.data) throw new Error('OpenCode 에이전트 목록을 읽지 못했습니다.')
  return agents.data
    .filter((agent) => !agent.hidden && agent.mode !== 'subagent')
    .map((agent) => ({
      name: agent.name,
      ...(agent.description ? { description: agent.description } : {}),
      ...(agent.model ? { model: `${agent.model.providerID}/${agent.model.modelID}` } : {}),
      ...(agent.variant ? { variant: agent.variant } : {})
    }))
}

export async function openCodeComposerModels(
  client: OpencodeClient,
  directory: string,
  signal?: AbortSignal
): Promise<NativeComposerCatalog['models']> {
  const providers = await client.provider.list({ directory }, { throwOnError: true, signal })
  if (!providers.data) throw new Error('OpenCode 모델 목록을 읽지 못했습니다.')
  return providers.data.all.flatMap((provider) =>
    Object.values(provider.models).map((model) => ({
      id: `${provider.id}/${model.id}`,
      variants: Object.entries(model.variants ?? {})
        .filter(([, value]) => value.disabled !== true)
        .map(([name]) => name)
    }))
  )
}

export async function openCodeComposerCatalog(
  client: OpencodeClient,
  directory: string,
  signal?: AbortSignal
): Promise<NativeComposerCatalog> {
  const [agents, models] = await Promise.all([
    openCodeComposerAgents(client, directory, signal),
    openCodeComposerModels(client, directory, signal)
  ])
  return { agents, models }
}
