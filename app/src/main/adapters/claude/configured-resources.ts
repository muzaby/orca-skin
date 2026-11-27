import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import type { NativeResource } from '../../../shared/native-resources'
import { isRecord } from '../../../shared/obj'
import { extensionChoices } from '../common/extension-control'
import { gitRootLineage } from '../common/git-root'
import { claudeNativePaths } from './native-paths'
import {
  readClaudePluginManifestAsync,
  readClaudeSettingsObjectAsync
} from './native-settings-file'
import { installedClaudePlugins } from './plugin-catalog'
import { readPluginMcpDeclarations } from './plugin-mcp-declarations'
import { claudePluginName } from './plugin-observations'
import { claudePluginEnabled } from './plugin-flag'
import { claudeLocalSettingsRoot, pluginPathKey } from './project-path'

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})

/** Match init observations to installation records without sending paths over IPC. */
export function nativePluginId(path: string): string {
  return `plugin:${createHash('sha256').update(pluginPathKey(path)).digest('hex')}`
}

function configured(
  id: string,
  name: string,
  kind: NativeResource['kind'],
  enabled: boolean,
  installedOnly = false
): NativeResource {
  return {
    id,
    name,
    kind,
    status: installedOnly ? 'installed' : enabled ? 'configured' : 'disabled',
    enabled,
    canToggle: false
  }
}

/** Metadata discovery only. Never loads a plugin, starts an MCP server or writes settings. */
async function readConfiguredClaudeResources(
  cwd: string,
  paths = {
    root: claudeNativePaths().root,
    globalConfig: process.env.CLAUDE_CONFIG_DIR?.trim()
      ? join(claudeNativePaths().root, '.claude.json')
      : join(homedir(), '.claude.json')
  },
  globalOnly = false,
  choices: Record<string, boolean> = {}
): Promise<{
  items: NativeResource[]
  directories: Map<string, string>
  mcpFiles: Map<string, string>
}> {
  const directories = new Map<string, string>()
  const mcpFiles = new Map<string, string>()
  const root = claudeLocalSettingsRoot(cwd)
  const nativeRoot = globalOnly ? cwd : await projectRoot(cwd)
  const [global, user, project, local, mcp, installed] = await Promise.all([
    readClaudeSettingsObjectAsync(paths.globalConfig),
    readClaudeSettingsObjectAsync(join(paths.root, 'settings.json')),
    globalOnly
      ? record(undefined)
      : readClaudeSettingsObjectAsync(join(root, '.claude', 'settings.json')),
    globalOnly
      ? record(undefined)
      : readClaudeSettingsObjectAsync(join(root, '.claude', 'settings.local.json')),
    globalOnly ? record(undefined) : readClaudeSettingsObjectAsync(join(root, '.mcp.json')),
    readClaudeSettingsObjectAsync(join(paths.root, 'plugins', 'installed_plugins.json'))
  ])
  const projects = record(global.projects)
  const projectEntry = (path: string): Record<string, unknown> =>
    record(
      Object.entries(projects).find(([key]) => pluginPathKey(key) === pluginPathKey(path))?.[1]
    )
  const current = globalOnly ? {} : { ...projectEntry(nativeRoot), ...projectEntry(cwd) }
  const enabledPlugins = {
    ...record(user.enabledPlugins),
    ...record(project.enabledPlugins),
    ...record(local.enabledPlugins),
    ...extensionChoices(choices, 'plugin')
  }
  const disabled = new Set(
    Array.isArray(current.disabledMcpServers) ? current.disabledMcpServers : []
  )
  const deniedProject = new Set(
    [
      current.disabledMcpjsonServers,
      user.disabledMcpjsonServers,
      project.disabledMcpjsonServers,
      local.disabledMcpjsonServers
    ].flatMap((value) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    )
  )
  const servers = new Map<string, NativeResource>()
  const addServers = (
    value: unknown,
    file: string,
    prefix = '',
    enabled = true,
    source?: string
  ): void => {
    for (const [name, config] of Object.entries(record(value))) {
      if (!isRecord(config) || config.type === 'sdk') continue
      const id = `${prefix}${name}`
      servers.set(id, {
        ...configured(
          id,
          id,
          'mcp',
          enabled && !disabled.has(id) && !(source === 'project' && deniedProject.has(id))
        )
      })
      if (globalOnly && (source === 'user' || prefix)) {
        const row = servers.get(id)!
        row.canToggle = true
        row.source = prefix ? 'plugin' : 'user'
      }
      mcpFiles.set(id, file)
    }
  }
  const plugins: NativeResource[] = []
  const pluginNames = new Map<string, string[]>()
  const applicable = installedClaudePlugins(cwd, installed.plugins, globalOnly)
  const selected = new Map<string, (typeof applicable)[number]>()
  for (const entry of applicable)
    if (!selected.has(entry.key) || entry.scope === 'managed') selected.set(entry.key, entry)
  for (const entry of globalOnly ? selected.values() : applicable) {
    const { key: name, path: installPath } = entry
    if (!isAbsolute(installPath)) continue
    if (!(await stat(installPath).catch(() => null))?.isDirectory()) continue
    const flag = enabledPlugins[name]
    const enabled = claudePluginEnabled(flag)
    const installedOnly = flag === undefined
    // An unreadable manifest excludes only that plugin, as the CLI does.
    const manifest = await readClaudePluginManifestAsync(installPath)
    if (!manifest) continue
    const id = nativePluginId(installPath)
    if (directories.has(id)) continue
    directories.set(id, installPath)
    const resolvedName = claudePluginName(installPath, manifest)
    if (resolvedName) pluginNames.set(resolvedName, [...(pluginNames.get(resolvedName) ?? []), id])
    plugins.push({
      ...configured(id, name, 'plugin', enabled, installedOnly),
      ...(globalOnly
        ? {
            canToggle: entry.scope === 'user' && !!resolvedName,
            ...(!resolvedName
              ? { controlReason: 'SDK에서 플러그인 이름을 확인하지 못했습니다.' }
              : {})
          }
        : {}),
      ...(typeof manifest.description === 'string'
        ? { description: manifest.description.trim().slice(0, 4000) }
        : {})
    })
    const pluginName = resolvedName ?? name.split('@')[0]
    const prefix = `plugin:${pluginName}:`
    for (const { value, file } of await readPluginMcpDeclarations(installPath, manifest))
      addServers(value, file, prefix, enabled)
  }
  if (globalOnly) {
    const ambiguous = new Set([...pluginNames.values()].filter((ids) => ids.length > 1).flat())
    for (const plugin of plugins) {
      if (!ambiguous.has(plugin.id)) continue
      plugin.canToggle = false
      plugin.controlReason = '같은 SDK 이름을 쓰는 설치가 둘 이상입니다.'
    }
  }
  addServers(global.mcpServers, paths.globalConfig, '', true, 'user')
  addServers(mcp.mcpServers, join(root, '.mcp.json'), '', true, 'project')
  addServers(current.mcpServers, paths.globalConfig)
  return { items: [...servers.values(), ...plugins], directories, mcpFiles }
}

/** Global navigation must never infer a project from the application's default cwd. */
export async function globalClaudeResources(
  paths?: Parameters<typeof readConfiguredClaudeResources>[1]
): Promise<NativeResource[]> {
  const result = await readConfiguredClaudeResources(homedir(), paths, true)
  return result.items.map((item) => ({
    ...item,
    canOpen: item.kind === 'plugin' ? result.directories.has(item.id) : result.mcpFiles.has(item.id)
  }))
}

export async function globalClaudeResourcePath(
  id: string,
  kind: NativeResource['kind']
): Promise<string | undefined> {
  const result = await readConfiguredClaudeResources(homedir(), undefined, true)
  return (kind === 'plugin' ? result.directories : result.mcpFiles).get(id)
}

export async function configuredClaudeResources(
  ...args: Parameters<typeof readConfiguredClaudeResources>
): Promise<NativeResource[]> {
  return (await readConfiguredClaudeResources(...args)).items
}

async function projectRoot(cwd: string): Promise<string> {
  try {
    return (await gitRootLineage(cwd)).root
  } catch {
    throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
  }
}
