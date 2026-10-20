import { join, resolve } from 'node:path'
import type { McpServerStatus, Query } from '@anthropic-ai/claude-agent-sdk'
import type { NativeCommand, NativeResource } from '../../../shared/native-resources'
import { nativePluginId } from './configured-resources'
import { resourceQuery } from '../common/resource-query'
import { pluginDescription } from '../common/plugin-description'

/** Owns observations for one Query; Orca MCPs carry a separate read-only origin. */
export function claudeNativeResources(
  query: Pick<Query, 'mcpServerStatus' | 'toggleMcpServer'> &
    Partial<Pick<Query, 'supportedCommands' | 'applyFlagSettings' | 'reloadPlugins'>>,
  injectedRoots: readonly string[] = [],
  injectedServers: readonly string[] = [],
  installations: readonly { key: string; name: string; path: string; enabled: boolean }[] = [],
  initialFlags: Record<string, boolean> = {}
): {
  observePlugins(plugins: readonly { name: string; path: string }[]): void
  observeCommands(names: readonly string[]): void
  commands(): Promise<NativeCommand[]>
  list(): Promise<NativeResource[]>
  directory(id: string): Promise<string | undefined>
  set(id: string, enabled: boolean, kind?: NativeResource['kind']): Promise<void>
} {
  let plugins: NativeResource[] = []
  const directories = new Map<string, string>()
  let commandNames: readonly string[] = []
  const injectedNames = new Set<string>()
  const roots = new Set(injectedRoots.map((root) => resolve(root)))
  const controls = new Map(installations.map((plugin) => [nativePluginId(plugin.path), plugin]))
  let flags = { ...initialFlags }
  const canTogglePlugins = !!query.applyFlagSettings && !!query.reloadPlugins
  const observePlugins = (entries: readonly { name: string; path: string }[]): void => {
    injectedNames.clear()
    directories.clear()
    const active = new Set(entries.map((plugin) => nativePluginId(plugin.path)))
    plugins = installations.map((plugin) => {
      const id = nativePluginId(plugin.path)
      directories.set(id, plugin.path)
      const enabled = active.has(id)
      return {
        id,
        name: plugin.key,
        kind: 'plugin',
        status: enabled ? 'enabled' : 'disabled',
        enabled,
        canToggle: canTogglePlugins
      }
    })
    for (const plugin of entries) {
      if (roots.has(resolve(plugin.path))) {
        injectedNames.add(plugin.name)
        continue
      }
      const id = nativePluginId(plugin.path)
      if (controls.has(id)) continue
      directories.set(id, plugin.path)
      plugins.push({
        id,
        name: plugin.name,
        kind: 'plugin',
        status: 'enabled',
        enabled: true,
        canToggle: false
      })
    }
  }
  observePlugins(installations.filter((plugin) => plugin.enabled))
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
    observePlugins,
    async list() {
      const servers = await query.mcpServerStatus()
      const injectedPrefix = (name: string): string | undefined =>
        [...injectedNames]
          .map((plugin) => `plugin:${plugin}:`)
          .find((prefix) => name.startsWith(prefix))
      return [
        ...servers
          .filter(
            (server) =>
              isNative(server) || (server.source === 'plugin' && !!injectedPrefix(server.name))
          )
          .map((server): NativeResource => ({
            id: server.name,
            name: injectedPrefix(server.name)
              ? server.name.slice(injectedPrefix(server.name)!.length)
              : server.name,
            kind: 'mcp',
            status: server.status,
            enabled: server.status !== 'disabled',
            canToggle: !injectedPrefix(server.name),
            ...(injectedPrefix(server.name) ? { origin: 'orca' as const } : {})
          })),
        ...(await Promise.all(
          plugins.map(async (plugin) => {
            const description = await pluginDescription(
              join(directories.get(plugin.id)!, '.claude-plugin', 'plugin.json')
            )
            return { ...plugin, ...(description ? { description } : {}) }
          })
        ))
      ]
    },
    async directory(id) {
      return directories.get(id)
    },
    async set(id, enabled, kind = 'mcp') {
      if (kind === 'plugin') {
        const plugin = controls.get(id)
        if (!plugin || !query.applyFlagSettings || !query.reloadPlugins)
          throw new Error('이 플러그인은 세션별 제어를 지원하지 않습니다.')
        const previous = flags
        const next = { ...flags, [`${plugin.name}@inline`]: enabled }
        try {
          await query.applyFlagSettings({ enabledPlugins: next })
          const result = await query.reloadPlugins()
          observePlugins(result.plugins)
          commandNames = result.commands
            .filter((command) => !command.builtin)
            .map((command) => command.name)
          if (result.plugins.some((item) => nativePluginId(item.path) === id) !== enabled)
            throw new Error('플러그인 활성 상태를 변경하지 못했습니다.')
          flags = next
        } catch (error) {
          try {
            await query.applyFlagSettings({ enabledPlugins: previous })
            const restored = await query.reloadPlugins()
            observePlugins(restored.plugins)
          } catch {
            // The subsequent menu refresh reports the actual state; never claim success.
          }
          throw error
        }
        return
      }
      const server = (await query.mcpServerStatus()).find(
        (item) => item.name === id && isNative(item)
      )
      if (!server) throw new Error('이 세션에 연결된 MCP 서버가 아닙니다.')
      await query.toggleMcpServer(id, enabled)
    }
  }
}
