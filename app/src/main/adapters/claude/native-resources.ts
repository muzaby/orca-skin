import { resolve } from 'node:path'
import type { McpServerStatus, Query } from '@anthropic-ai/claude-agent-sdk'
import type { NativeCommand, NativeResource } from '../../../shared/native-resources'
import { nativePluginId } from './configured-resources'
import { resourceQuery } from '../common/resource-query'

/** Owns native observations for one Query; Orca injected resources are excluded. */
export function claudeNativeResources(
  query: Pick<Query, 'mcpServerStatus' | 'toggleMcpServer'> &
    Partial<Pick<Query, 'supportedCommands'>>,
  injectedRoots: readonly string[] = [],
  injectedServers: readonly string[] = []
): {
  observePlugins(plugins: readonly { name: string; path: string }[]): void
  observeCommands(names: readonly string[]): void
  commands(): Promise<NativeCommand[]>
  list(): Promise<NativeResource[]>
  set(id: string, enabled: boolean): Promise<void>
} {
  let plugins: NativeResource[] = []
  let commandNames: readonly string[] = []
  const injectedNames = new Set<string>()
  const roots = new Set(injectedRoots.map((root) => resolve(root)))
  const isNative = (server: McpServerStatus): boolean =>
    server.source !== 'sdk' &&
    !injectedServers.includes(server.name) &&
    ![...injectedNames].some((name) => server.name.startsWith(`plugin:${name}:`))
  return {
    observeCommands(names) {
      commandNames = names
    },
    async commands() {
      const commands = query.supportedCommands
        ? await resourceQuery(() => query.supportedCommands!(), 1500)
        : commandNames.map((name) => ({ name, description: '', argumentHint: '', builtin: false }))
      return commands
        .filter(
          (command) =>
            !command.builtin &&
            !injectedServers.some((name) => command.name.startsWith(`mcp__${name}__`)) &&
            ![...injectedNames].some(
              (name) =>
                command.name.startsWith(`${name}:`) ||
                command.name.startsWith(`mcp__plugin:${name}:`)
            )
        )
        .map((command) => ({
          name: command.name,
          description: command.description,
          argumentHint: command.argumentHint,
          source: command.name.startsWith('mcp__')
            ? 'mcp'
            : command.name.includes(':')
              ? 'plugin'
              : 'harness'
        }))
    },
    observePlugins(entries) {
      injectedNames.clear()
      plugins = entries.flatMap((plugin) => {
        if (roots.has(resolve(plugin.path))) {
          injectedNames.add(plugin.name)
          return []
        }
        return [
          {
            id: nativePluginId(plugin.path),
            name: plugin.name,
            kind: 'plugin' as const,
            status: 'enabled' as const,
            enabled: true,
            canToggle: false
          }
        ]
      })
    },
    async list() {
      const servers = await query.mcpServerStatus()
      return [
        ...servers.filter(isNative).map((server): NativeResource => ({
          id: server.name,
          name: server.name,
          kind: 'mcp',
          status: server.status,
          enabled: server.status !== 'disabled',
          canToggle: true
        })),
        ...plugins
      ]
    },
    async set(id, enabled) {
      const server = (await query.mcpServerStatus()).find(
        (item) => item.name === id && isNative(item)
      )
      if (!server) throw new Error('이 세션에 연결된 MCP 서버가 아닙니다.')
      await query.toggleMcpServer(id, enabled)
    }
  }
}
