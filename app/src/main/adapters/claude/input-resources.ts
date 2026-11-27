import type { McpServerStatus, Options, Query } from '@anthropic-ai/claude-agent-sdk'
import { setTimeout as delay } from 'node:timers/promises'
import { canonicalJson } from '../../../shared/obj'
import { PRODUCT_SLUG } from '../../../shared/product'
import { extensionChoices, managedChoiceKey } from '../common/extension-control'
import type { OoMcpConfig } from '../common/mcp-config'
import type { TurnExtensions } from '../common/turn'
import { resourceQuery } from '../common/resource-query'
import type { ClaudePluginCatalog } from './plugin-catalog'

export class UnregisteredClaudeMcpError extends Error {}

interface Target {
  name: string
  enabled: boolean
  sources: readonly string[]
  expectRegistration?: boolean
  absentWhenOff?: boolean
}

export function claudeInputResources(
  extensions: TurnExtensions,
  choices: Record<string, boolean>,
  plugins: ClaudePluginCatalog,
  nativeDefinitions: OoMcpConfig = {}
) {
  const managed = extensions.managedMcp
  const targets: Target[] = []
  const servers = new Map(extensions.runtimeTools?.servers)
  const external: NonNullable<Options['mcpServers']> = {}
  for (const [id, plugin] of managed?.plugins ?? []) {
    const enabled = choices[managedChoiceKey('builtin', plugin.identity.sourceId)]
    if (enabled === false) servers.delete(id)
    if (enabled !== undefined)
      targets.push({
        name: id,
        enabled,
        sources: ['sdk'],
        expectRegistration: true,
        absentWhenOff: true
      })
  }
  for (const [id, config] of Object.entries(managed?.definitions ?? managed?.users ?? {})) {
    const selected = choices[managedChoiceKey('user', id)]
    if (selected === undefined) continue
    const inBundle = managed?.desired?.[id] ?? Object.hasOwn(managed?.users ?? {}, id)
    const name = `plugin:${PRODUCT_SLUG}:${id}`
    if (!inBundle && selected) external[name] = config
    targets.push({
      name,
      enabled: selected,
      sources: [inBundle ? 'plugin' : 'dynamic'],
      expectRegistration: true,
      absentWhenOff: !inBundle
    })
  }
  const nativeMcp = extensionChoices(choices, 'mcp')
  for (const plugin of plugins.installations) {
    if (!plugin.enabled || choices[`plugin:${plugin.key}`] !== true) continue
    for (const name of plugin.bundledMcp ?? []) {
      const id = `plugin:${plugin.name}:${name}`
      nativeMcp[id] ??= true
    }
  }
  for (const [name, enabled] of Object.entries(nativeMcp)) {
    const parent = plugins.installations.find((item) => name.startsWith(`plugin:${item.name}:`))
    if (parent && !parent.enabled) continue
    if (Object.hasOwn(nativeDefinitions, name)) external[name] = nativeDefinitions[name]
    targets.push({
      name,
      enabled,
      sources: name.startsWith('plugin:')
        ? ['plugin']
        : external[name]
          ? ['dynamic', 'user']
          : ['user'],
      expectRegistration: !!external[name] || !!parent
    })
  }
  return {
    targets,
    external,
    runtimeTools: extensions.runtimeTools && { ...extensions.runtimeTools, servers },
    // Changing a local root, injected server or an in-process server needs new SDK options.
    spawnKey: canonicalJson([
      extensionChoices(choices, 'plugin'),
      [...servers.keys()].sort(),
      Object.keys(external).sort()
    ])
  }
}

// The CLI persists toggleMcpServer in its project state. Sibling Queries may inspect
// their own live state concurrently, but writes sharing that state file must serialize.
const mutations = new Map<string, Promise<void>>()
async function serializeMutation(root: string, mutate: () => Promise<void>): Promise<void> {
  const previous = mutations.get(root)
  const current = (previous ?? Promise.resolve()).catch(() => undefined).then(mutate)
  mutations.set(root, current)
  try {
    await current
  } finally {
    if (mutations.get(root) === current) mutations.delete(root)
  }
}

export async function applyClaudeInputResources(
  query: Pick<Query, 'mcpServerStatus' | 'toggleMcpServer'>,
  root: string,
  targets: Target[],
  current: () => boolean,
  signal: AbortSignal
): Promise<void> {
  if (!targets.length) return
  const status = (): Promise<McpServerStatus[]> =>
    resourceQuery(() => query.mcpServerStatus(), 30_000)
  const find = (rows: McpServerStatus[], target: Target) =>
    rows.find((row) => row.name === target.name && target.sources.includes(row.source ?? ''))
  let rows = await status()
  for (const target of targets) {
    if (!current()) return
    signal.throwIfAborted()
    const expected = target.enabled ? 'connected' : 'disabled'
    const deadline = Date.now() + 30_000
    let observed = find(rows, target)
    while (
      !observed &&
      target.enabled &&
      target.expectRegistration &&
      !rows.some((server) => server.name === target.name) &&
      Date.now() < deadline
    ) {
      if (!current()) return
      await delay(100, undefined, { signal })
      rows = await status()
      observed = find(rows, target)
    }
    if (!observed && !target.enabled && target.absentWhenOff) continue
    if (!observed)
      throw new UnregisteredClaudeMcpError(
        `Claude MCP 등록·출처를 확인하지 못했습니다: ${target.name}`
      )
    if (observed.status === expected) continue
    // Never mutate a different server that appeared under this name while waiting.
    await serializeMutation(root, async () => {
      rows = await status()
      if (!current()) return
      signal.throwIfAborted()
      const server = find(rows, target)
      if (!server) throw new Error(`Claude MCP 출처가 변경됐습니다: ${target.name}`)
      if (server.status === expected) return
      if (server.status !== 'pending' || !target.enabled)
        await query.toggleMcpServer(target.name, target.enabled)
    })
    while (current()) {
      signal.throwIfAborted()
      rows = await status()
      const actual = find(rows, target)?.status
      if (actual === expected) break
      if (actual !== 'pending' || Date.now() >= deadline)
        throw new Error(
          `Claude MCP 상태를 적용하지 못했습니다: ${target.name} (${actual ?? '미등록'})`
        )
      await delay(100, undefined, { signal })
    }
  }
}
