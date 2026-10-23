import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { isRecord } from '../../../../shared/obj'
import type { NativeResource } from '../../../../shared/native-resources'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'
import { withinSkillRoot } from './skill-sources'

import { parseConfig } from './openCodePluginConfig'
import { effectiveOpenCodePlugins, openCodeGlobalConfigFiles } from './global-plugins'
export { parseConfig } from './openCodePluginConfig'

/** Resolve only a file that actually declares this server; never invent a default path. */
async function configuredOpenCode(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  globalOnly = false
): Promise<{
  files: Map<string, string>
  items: NativeResource[]
  pluginSkillDirectories: string[]
}> {
  const globalRoot = join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode')
  const lineage: string[] = []
  let current = resolve(cwd)
  for (; !globalOnly;) {
    lineage.unshift(current)
    try {
      await stat(join(current, '.git'))
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  const at = (root: string): string[] => [join(root, 'opencode.json'), join(root, 'opencode.jsonc')]
  const files = [
    join(globalRoot, 'config.json'),
    ...at(globalRoot),
    ...(env.OPENCODE_CONFIG ? [resolve(cwd, env.OPENCODE_CONFIG)] : []),
    ...(env.OPENCODE_DISABLE_PROJECT_CONFIG === 'true' ? [] : lineage.flatMap(at)),
    ...lineage.flatMap((root) => at(join(root, '.opencode'))),
    ...(env.OPENCODE_CONFIG_DIR ? at(resolve(cwd, env.OPENCODE_CONFIG_DIR)) : []),
    ...(process.platform === 'win32' && env.ProgramData
      ? at(join(env.ProgramData, 'opencode'))
      : [])
  ]
  const declarations = new Map<string, string>()
  const servers = new Map<string, NativeResource>()
  const plugins = new Set<string>()
  const globalFiles = new Set(openCodeGlobalConfigFiles(env))
  const effective = await effectiveOpenCodePlugins(env)
  const skillPaths = new Set<string>()
  for (const file of files) {
    try {
      const config = parseConfig(await readFile(file, 'utf8'))
      if (!isRecord(config)) continue
      for (const [id, value] of Object.entries(isRecord(config.mcp) ? config.mcp : {})) {
        if (!isRecord(value)) continue
        declarations.set(id, file)
        const enabled = value.enabled !== false
        servers.set(id, {
          id,
          name: id,
          kind: 'mcp',
          enabled,
          status: enabled ? 'configured' : 'disabled',
          canToggle: false
        })
      }
      if (Array.isArray(config.plugin) && (!globalFiles.has(file) || file === effective.file))
        for (const plugin of config.plugin) {
          const spec = Array.isArray(plugin) ? plugin[0] : plugin
          if (typeof spec === 'string') plugins.add(spec)
        }
      if (isRecord(config.skills) && Array.isArray(config.skills.paths))
        for (const path of config.skills.paths)
          if (typeof path === 'string') skillPaths.add(resolve(cwd, path))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('OpenCode MCP 설정 파일을 확인할 수 없습니다.')
    }
  }
  const pluginSkillDirectories = new Set<string>()
  const installed = await Promise.all(
    [...plugins].map(async (source): Promise<NativeResource> => {
      const installation = await openCodePluginInstallation(source, cwd, env)
      if (installation) {
        pluginSkillDirectories.add(join(installation.directory, 'skills'))
        pluginSkillDirectories.add(join(installation.directory, 'skill'))
        for (const path of skillPaths)
          if (withinSkillRoot(path, installation.directory)) pluginSkillDirectories.add(path)
      }
      return {
        id: openCodePluginId(source),
        name: source.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).at(-1) ?? 'Plugin',
        kind: 'plugin',
        enabled: true,
        status: installation ? 'installed' : 'configured',
        canToggle: false
      }
    })
  )
  return {
    files: declarations,
    items: [...servers.values(), ...installed],
    pluginSkillDirectories: [...pluginSkillDirectories]
  }
}

export async function globalOpenCodeResources(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir()
): Promise<NativeResource[]> {
  const result = await configuredOpenCode(home, env, true)
  const effective = await effectiveOpenCodePlugins(env, home)
  const editable = new Set(
    effective.entries.map((entry) => openCodePluginId(typeof entry === 'string' ? entry : entry[0]))
  )
  return result.items.map((item) => ({
    ...item,
    canToggle: item.kind === 'mcp' || (editable.has(item.id) && item.status === 'installed'),
    canOpen: result.files.has(item.id)
  }))
}

export async function globalOpenCodeMcpFile(id: string): Promise<string | undefined> {
  return (await configuredOpenCode(homedir(), process.env, true)).files.get(id)
}

export async function configuredOpenCodeMcpFile(
  cwd: string,
  id: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  return (await configuredOpenCode(cwd, env)).files.get(id)
}

export async function configuredOpenCodeResources(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<NativeResource[]> {
  return (await configuredOpenCode(cwd, env)).items
}

export async function configuredOpenCodePluginSkillDirectories(
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env
): Promise<string[]> {
  // Catalog discovery is read-only: never import plugin code to execute its config hooks.
  return (
    await configuredOpenCode(home, {
      ...env,
      XDG_CONFIG_HOME: env.XDG_CONFIG_HOME || join(home, '.config'),
      OPENCODE_DISABLE_PROJECT_CONFIG: 'true'
    })
  ).pluginSkillDirectories
}
