import { resolve } from 'node:path'
import type { McpServerStatus, Query } from '@anthropic-ai/claude-agent-sdk'
import type { NativeResource } from '../../../shared/native-resources'

/** Owns native observations for one Query; Orca injected resources are excluded. */
export function claudeNativeResources(
  query: Pick<Query, 'mcpServerStatus' | 'toggleMcpServer'>,
  injectedRoots: readonly string[] = [],
  injectedServers: readonly string[] = []
): {
  observePlugins(plugins: readonly { name: string; path: string }[]): void
  list(): Promise<NativeResource[]>
  set(id: string, enabled: boolean): Promise<void>
} {
  let plugins: NativeResource[] = []
  const injectedNames = new Set<string>()
  const roots = new Set(injectedRoots.map((root) => resolve(root)))
  const isNative = (server: McpServerStatus): boolean =>
    server.source !== 'sdk' &&
    !injectedServers.includes(server.name) &&
    ![...injectedNames].some((name) => server.name.startsWith(`plugin:${name}:`))
  return {
    observePlugins(entries) {
      injectedNames.clear()
      plugins = entries.flatMap((plugin, index) => {
        if (roots.has(resolve(plugin.path))) {
          injectedNames.add(plugin.name)
          return []
        }
        return [
          {
            id: `plugin:${index}`,
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
