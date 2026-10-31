import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { realpath } from 'node:fs/promises'
import type { NativeCommand, NativeResource } from '../../../../shared/native-resources'
import { classifyMcpError, opaqueIdentity } from './diagnostics'
import { pluginSpec } from './openCodePluginConfig'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'
import { retentionTrace } from './retention-trace'
import { isOpenCodeSkill, withinSkillRoot } from './skill-sources'

export async function openCodeNativeCommands(
  client: OpencodeClient,
  directory: string,
  inventory = false,
  env: NodeJS.ProcessEnv = process.env,
  read?: { signal: AbortSignal; timeoutMs: number },
  configuration?: ReturnType<OpencodeClient['config']['get']>
): Promise<NativeCommand[]> {
  const timeout = AbortSignal.timeout(read?.timeoutMs ?? 2500)
  const result = await client.command.list(
    { directory },
    { throwOnError: true, signal: read ? AbortSignal.any([read.signal, timeout]) : timeout }
  )
  const hasSkills = inventory && result.data?.some((command) => command.source === 'skill')
  const options = { throwOnError: true as const, signal: AbortSignal.timeout(2500) }
  const [skillsResult, configResult] = hasSkills
    ? await Promise.all([
        client.app.skills({ directory }, options),
        configuration ?? client.config.get({ directory }, options)
      ])
    : []
  if (hasSkills && !configResult?.data) throw new Error('OpenCode plugin configuration unavailable')
  const skills = skillsResult?.data ?? []
  const config = configResult?.data
  const plugins = await Promise.all(
    (config?.plugin ?? []).map((source) =>
      openCodePluginInstallation(pluginSpec(source), directory, env)
    )
  )
  return Promise.all(
    (result.data ?? []).map(async (command) => {
      const file = skills.find((skill) => skill.name === command.name)?.location
      const location = file ? await realpath(file).catch(() => file) : undefined
      const plugin =
        location && plugins.some((entry) => entry && withinSkillRoot(location, entry.directory))
      return {
        name: command.name,
        description: command.description ?? '',
        argumentHint: command.hints.join(' '),
        source:
          command.source === 'mcp'
            ? ('mcp' as const)
            : plugin
              ? ('plugin' as const)
              : ('harness' as const),
        ...(inventory
          ? {
              skill:
                command.source === 'skill' &&
                !!location &&
                (!!plugin || (await isOpenCodeSkill(location, directory, env)))
            }
          : {})
      }
    })
  )
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

export async function openCodeNativeMcp(
  client: OpencodeClient,
  directory: string,
  signal?: AbortSignal
): Promise<NativeResource[]> {
  const mcp = await client.mcp.status({ directory }, { throwOnError: false, signal })
  if (!mcp.data)
    throw new Error('OpenCode MCP status unavailable', { cause: { status: mcp.response?.status } })
  return Object.entries(mcp.data).map(([name, value]): NativeResource => {
    const status =
      value.status === 'needs_client_registration' || value.status === 'needs_auth'
        ? 'needs-auth'
        : value.status
    retentionTrace('mcp.status-detail', {
      instance: opaqueIdentity(directory),
      mcp: opaqueIdentity(name),
      status,
      ...('error' in value ? { errorClass: classifyMcpError(value.error) } : {})
    })
    return {
      id: name,
      name,
      kind: 'mcp',
      status,
      enabled: value.status !== 'disabled',
      canToggle: false
    }
  })
}

export async function openCodeNativePlugins(
  client: OpencodeClient,
  directory: string,
  env: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
  configuration?: ReturnType<OpencodeClient['config']['get']>
): Promise<NativeResource[]> {
  const config = await (configuration ??
    client.config.get({ directory }, { throwOnError: false, signal }))
  if (!config.data)
    throw new Error('OpenCode plugin configuration unavailable', {
      cause: { status: config.response?.status }
    })
  return Promise.all(
    (config.data?.plugin ?? []).map(async (entry): Promise<NativeResource> => {
      const spec = pluginSpec(entry)
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
}
