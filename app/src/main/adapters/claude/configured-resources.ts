import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { NativeResource } from '../../../shared/native-resources'
import { isRecord } from '../../../shared/obj'
import { readJsonObject } from '../../infra/config/json-file'
import { extensionChoices } from '../common/extension-control'
import { gitRootLineage } from '../common/git-root'
import { claudeNativePaths } from './native-paths'
import { claudeInstallationExists, installedClaudePlugins } from './plugin-catalog'
import { claudePluginEnabled } from './plugin-flag'
import { claudeLocalSettingsRoot, pluginPathKey } from './project-path'
const readObject = (file: string): Promise<Record<string, unknown>> =>
  readJsonObject(file, () => new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.'))

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

function pluginFile(root: string, value: string): string | undefined {
  const file = resolve(root, value.replaceAll('${CLAUDE_PLUGIN_ROOT}', root))
  const child = relative(root, file)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child) ? file : undefined
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
    readObject(paths.globalConfig),
    readObject(join(paths.root, 'settings.json')),
    globalOnly ? record(undefined) : readObject(join(root, '.claude', 'settings.json')),
    globalOnly ? record(undefined) : readObject(join(root, '.claude', 'settings.local.json')),
    globalOnly ? record(undefined) : readObject(join(root, '.mcp.json')),
    readObject(join(paths.root, 'plugins', 'installed_plugins.json'))
  ])
  const projects = record(global.projects)
  const projectEntry = (path: string): Record<string, unknown> =>
    record(
      Object.entries(projects).find(([key]) => pluginPathKey(key) === pluginPathKey(path))?.[1]
    )
  const current = globalOnly ? {} : { ...projectEntry(nativeRoot), ...projectEntry(cwd) }
  const enabledPlugins = {
    ...record(user.enabledPlugins),
    ...extensionChoices(choices, 'plugin'),
    ...record(project.enabledPlugins),
    ...record(local.enabledPlugins)
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
      mcpFiles.set(id, file)
    }
  }
  const plugins: NativeResource[] = []
  const applicable = installedClaudePlugins(cwd, installed.plugins, globalOnly)
  const selected = new Map<string, (typeof applicable)[number]>()
  for (const entry of applicable)
    if (!selected.has(entry.key) || entry.scope === 'managed') selected.set(entry.key, entry)
  for (const entry of globalOnly ? selected.values() : applicable) {
    const { key: name, path: installPath } = entry
    if (!isAbsolute(installPath) || !claudeInstallationExists(installPath)) continue
    const flag = enabledPlugins[name]
    const enabled = claudePluginEnabled(flag)
    const installedOnly = flag === undefined
    const manifest = await readObject(join(installPath, '.claude-plugin', 'plugin.json'))
    const id = nativePluginId(installPath)
    if (directories.has(id)) continue
    directories.set(id, installPath)
    plugins.push({
      ...configured(id, name, 'plugin', enabled, installedOnly),
      ...(globalOnly
        ? { canToggle: entry.scope === 'user' && typeof manifest.name === 'string' }
        : {}),
      ...(typeof manifest.description === 'string'
        ? { description: manifest.description.trim().slice(0, 4000) }
        : {})
    })
    const pluginName = typeof manifest.name === 'string' ? manifest.name : name.split('@')[0]
    const prefix = `plugin:${pluginName}:`
    const bundledMcp = await readObject(join(installPath, '.mcp.json'))
    addServers(bundledMcp.mcpServers ?? bundledMcp, join(installPath, '.mcp.json'), prefix, enabled)
    const declarations = Array.isArray(manifest.mcpServers)
      ? manifest.mcpServers
      : [manifest.mcpServers]
    for (const declaration of declarations) {
      if (typeof declaration === 'string') {
        const file = pluginFile(installPath, declaration)
        if (file) {
          const extra = await readObject(file)
          addServers(extra.mcpServers ?? extra, file, prefix, enabled)
        }
      } else
        addServers(declaration, join(installPath, '.claude-plugin', 'plugin.json'), prefix, enabled)
    }
  }
  addServers(global.mcpServers, paths.globalConfig)
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
