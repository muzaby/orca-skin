import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { NativeResource } from '../../../shared/native-resources'
import { isRecord } from '../../../shared/obj'
import { claudeNativePaths } from './native-paths'

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})
const pathKey = (value: string): string => {
  const normalized = resolve(value.replaceAll('\\', '/'))
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

/** Match init observations to installation records without sending paths over IPC. */
export function nativePluginId(path: string): string {
  return `plugin:${createHash('sha256').update(pathKey(path)).digest('hex')}`
}

async function readObject(file: string): Promise<Record<string, unknown>> {
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
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
export async function configuredClaudeResources(
  cwd: string,
  paths = {
    root: claudeNativePaths().root,
    globalConfig: process.env.CLAUDE_CONFIG_DIR?.trim()
      ? join(claudeNativePaths().root, '.claude.json')
      : join(homedir(), '.claude.json')
  }
): Promise<NativeResource[]> {
  const root = await projectRoot(cwd)
  const [global, user, project, local, mcp, installed] = await Promise.all([
    readObject(paths.globalConfig),
    readObject(join(paths.root, 'settings.json')),
    readObject(join(root, '.claude', 'settings.json')),
    readObject(join(root, '.claude', 'settings.local.json')),
    readObject(join(root, '.mcp.json')),
    readObject(join(paths.root, 'plugins', 'installed_plugins.json'))
  ])
  const projects = record(global.projects)
  const projectEntry = (path: string): Record<string, unknown> =>
    record(Object.entries(projects).find(([key]) => pathKey(key) === pathKey(path))?.[1])
  const current = { ...projectEntry(root), ...projectEntry(cwd) }
  const enabledPlugins = {
    ...record(user.enabledPlugins),
    ...record(project.enabledPlugins),
    ...record(local.enabledPlugins)
  }
  const disabled = new Set(
    [
      current.disabledMcpServers,
      current.disabledMcpjsonServers,
      user.disabledMcpjsonServers,
      project.disabledMcpjsonServers,
      local.disabledMcpjsonServers
    ].flatMap((value) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    )
  )
  const servers = new Map<string, NativeResource>()
  const addServers = (value: unknown, prefix = '', enabled = true): void => {
    for (const [name, config] of Object.entries(record(value))) {
      if (!isRecord(config) || config.type === 'sdk') continue
      const id = `${prefix}${name}`
      servers.set(id, configured(id, id, 'mcp', enabled && !disabled.has(id)))
    }
  }
  const plugins: NativeResource[] = []
  const installations = record(installed.plugins)
  for (const [name, entries] of Object.entries(installations)) {
    if (!Array.isArray(entries)) continue
    const applicable = entries.filter((entry): entry is Record<string, unknown> => {
      if (!isRecord(entry) || typeof entry.installPath !== 'string') return false
      if (entry.scope === 'user' || entry.scope === 'managed') return true
      return (
        (entry.scope === 'project' || entry.scope === 'local') &&
        typeof entry.projectPath === 'string' &&
        [root, cwd].some((path) => pathKey(path) === pathKey(entry.projectPath as string))
      )
    })
    // The highest scope is the active installation for a plugin id.
    const rank = (entry: Record<string, unknown>): number =>
      ['user', 'project', 'local', 'managed'].indexOf(String(entry.scope))
    const entry = applicable.sort((a, b) => rank(b) - rank(a))[0]
    if (!entry) continue
    const installPath = entry.installPath as string
    const flag = enabledPlugins[name]
    const enabled = flag === true || Array.isArray(flag) || isRecord(flag)
    plugins.push(
      configured(nativePluginId(installPath), name, 'plugin', enabled, flag === undefined)
    )
    const manifest = await readObject(join(installPath, '.claude-plugin', 'plugin.json'))
    const pluginName = typeof manifest.name === 'string' ? manifest.name : name.split('@')[0]
    const prefix = `plugin:${pluginName}:`
    const bundledMcp = await readObject(join(installPath, '.mcp.json'))
    addServers(bundledMcp.mcpServers ?? bundledMcp, prefix, enabled)
    const declarations = Array.isArray(manifest.mcpServers)
      ? manifest.mcpServers
      : [manifest.mcpServers]
    for (const declaration of declarations) {
      if (typeof declaration === 'string') {
        const file = pluginFile(installPath, declaration)
        if (file) {
          const extra = await readObject(file)
          addServers(extra.mcpServers ?? extra, prefix, enabled)
        }
      } else addServers(declaration, prefix, enabled)
    }
  }
  addServers(global.mcpServers)
  addServers(mcp.mcpServers)
  addServers(current.mcpServers)
  return [...servers.values(), ...plugins]
}
