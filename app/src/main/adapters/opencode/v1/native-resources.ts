import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeCommand, NativeResource } from '../../../../shared/native-resources'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'

export async function openCodeNativeCommands(
  client: OpencodeClient,
  directory: string
): Promise<NativeCommand[]> {
  const result = await client.command.list(
    { directory },
    { throwOnError: true, signal: AbortSignal.timeout(2500) }
  )
  return (result.data ?? []).map((command) => ({
    name: command.name,
    description: command.description ?? '',
    argumentHint: command.hints.join(' '),
    source: command.source === 'mcp' ? 'mcp' : 'harness'
  }))
}

function pluginName(source: string): string {
  // File references and URLs can carry machine paths or query secrets; expose only a name.
  if (
    source.startsWith('file:') ||
    source.includes('://') ||
    /^[A-Za-z]:[\\/]/.test(source) ||
    source.startsWith('/') ||
    source.startsWith('.') ||
    source.includes('\\')
  ) {
    return source.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).at(-1) ?? 'Plugin'
  }
  return source
}

export async function openCodeNativeResources(
  client: OpencodeClient,
  directory: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<NativeResource[]> {
  const [mcp, config] = await Promise.all([
    client.mcp.status({ directory }, { throwOnError: true }),
    client.config.get({ directory }, { throwOnError: true })
  ])
  const servers = Object.entries(mcp.data ?? {}).map(([name, value]): NativeResource => ({
    id: name,
    name,
    kind: 'mcp',
    status:
      value.status === 'needs_client_registration'
        ? 'needs-auth'
        : value.status === 'needs_auth'
          ? 'needs-auth'
          : value.status,
    enabled: value.status !== 'disabled',
    canToggle: false
  }))
  const plugins = await Promise.all(
    (config.data?.plugin ?? []).map(async (entry): Promise<NativeResource> => {
      const spec = typeof entry === 'string' ? entry : entry[0]
      const installed = await openCodePluginInstallation(spec, directory, env)
      return {
        id: openCodePluginId(spec),
        name: pluginName(spec),
        kind: 'plugin',
        status: 'enabled',
        enabled: true,
        canToggle: false,
        ...(installed?.description ? { description: installed.description } : {})
      }
    })
  )
  return [...servers, ...plugins]
}

export async function openCodeNativePluginDirectory(
  client: OpencodeClient,
  directory: string,
  id: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  const config = await client.config.get(
    { directory },
    { throwOnError: true, signal: AbortSignal.timeout(2500) }
  )
  const spec = (config.data?.plugin ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry[0]))
    .find((value) => openCodePluginId(value) === id)
  return spec ? (await openCodePluginInstallation(spec, directory, env))?.directory : undefined
}
