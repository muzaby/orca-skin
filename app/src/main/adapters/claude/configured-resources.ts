import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { NativeResource } from '../../../shared/native-resources'
import { isRecord } from '../../../shared/obj'
import { claudeNativePaths } from './native-paths'
import { installedClaudePlugins, pluginPathKey } from './plugin-catalog'
import { claudeLocalSettingsRoot } from './project-path'

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})
const pathKey = pluginPathKey

/** Match init observations to installation records without sending paths over IPC. */
export function nativePluginId(path: string): string {
  return `plugin:${createHash('sha256').update(pathKey(path)).digest('hex')}`
}

async function readObject(file: string): Promise<Record<string, unknown>> {
  try {
    const value: unknown = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
    if (!isRecord(value)) throw new Error('invalid object')
    return value
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    // JSON parse errors and filesystem errors can contain credentials or private paths.
    throw new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.')
  }
}

async function projectRoot(cwd: string): Promise<string> {
  let current = resolve(cwd)
  for (;;) {
    try {
      await stat(join(current, '.git'))
      return current
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
    }
    const parent = dirname(current)
    if (parent === current) return resolve(cwd)
    current = parent
  }
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
  globalOnly = false
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
    record(Object.entries(projects).find(([key]) => pathKey(key) === pathKey(path))?.[1])
  const current = globalOnly ? {} : { ...projectEntry(nativeRoot), ...projectEntry(cwd) }
  const enabledPlugins = {
    ...record(user.enabledPlugins),
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
    const flag = enabledPlugins[name]
    const enabled = flag === true || Array.isArray(flag) || isRecord(flag)
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

export async function configuredClaudePluginDirectory(
  cwd: string,
  id: string,
  paths?: Parameters<typeof readConfiguredClaudeResources>[1]
): Promise<string | undefined> {
  return (await readConfiguredClaudeResources(cwd, paths)).directories.get(id)
}

export async function configuredClaudeMcpFile(
  cwd: string,
  id: string,
  paths?: Parameters<typeof readConfiguredClaudeResources>[1]
): Promise<string | undefined> {
  return (await readConfiguredClaudeResources(cwd, paths)).mcpFiles.get(id)
}
