import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeResource } from '../../../../shared/native-resources'

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
  directory: string
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
  const plugins = (config.data?.plugin ?? []).map((entry, index): NativeResource => ({
    id: `plugin:${index}`,
    name: pluginName(typeof entry === 'string' ? entry : entry[0]),
    kind: 'plugin',
    status: 'enabled',
    enabled: true,
    canToggle: false
  }))
  return [...servers, ...plugins]
}
