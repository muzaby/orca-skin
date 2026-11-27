import { isDeepStrictEqual } from 'node:util'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { NativeResource } from '../../../../shared/native-resources'
import { isRecord } from '../../../../shared/obj'
import { gitRootLineage } from '../../common/git-root'
import {
  openCodeDiscovery,
  discoveryReadFile as readFile,
  discoveryStat as stat
} from './discovery-cache'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'
import { withinSkillRoot } from './skill-sources'

import { effectiveOpenCodePlugins, openCodeGlobalConfigFiles } from './global-plugins'
import { parseConfig } from './openCodePluginConfig'
export { parseConfig } from './openCodePluginConfig'

/** Resolve only a file that actually declares this server; never invent a default path. */
async function readConfiguredOpenCode(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  globalOnly = false
): Promise<{
  definitions: Map<string, Record<string, unknown> | null>
  files: Map<string, string>
  items: NativeResource[]
  pluginSkillDirectories: string[]
}> {
  const globalRoot = join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode')
  const lineage = globalOnly ? [] : (await gitRootLineage(cwd, stat)).directories.reverse()
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
  const definitions = new Map<string, Record<string, unknown> | null>()
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
        if (!isRecord(value)) {
          definitions.set(id, null)
          continue
        }
        const prior = definitions.get(id)
        const { enabled: _enabled, ...definition } = value
        // An enabled-only declaration inherits its target. An invalid nearer target
        // must never be mistaken for the previously read global one.
        if (Object.keys(definition).length > 0 || prior === undefined) {
          definitions.set(id, { ...prior, ...definition })
        }
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
        status: 'configured',
        canToggle: false
      }
    })
  )
  return {
    files: declarations,
    definitions,
    items: [...servers.values(), ...installed],
    pluginSkillDirectories: [...pluginSkillDirectories]
  }
}

async function configuredOpenCode(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
  globalOnly = false
): ReturnType<typeof readConfiguredOpenCode> {
  return openCodeDiscovery.run(
    openCodeDiscovery.key('configured', cwd, env, String(globalOnly)),
    () => readConfiguredOpenCode(cwd, env, globalOnly)
  )
}

function identifiableMcp(definition: Record<string, unknown> | null | undefined): boolean {
  return (
    !!definition &&
    ((definition.type === 'remote' &&
      typeof definition.url === 'string' &&
      definition.url.length > 0) ||
      (definition.type === 'local' &&
        Array.isArray(definition.command) &&
        definition.command.length > 0 &&
        definition.command.every((part) => typeof part === 'string')))
  )
}

/** Compare execution definitions in the host. Only ids, defaults and limitations leave here. */
export async function openCodeMcpScope(
  cwd: string,
  env: NodeJS.ProcessEnv,
  profile: Record<string, unknown>
): Promise<{ defaults: Record<string, boolean>; restricted: Set<string>; nativeIds: string[] }> {
  const [global, effective] = await Promise.all([
    configuredOpenCode(homedir(), env, true),
    configuredOpenCode(cwd, env)
  ])
  const defaults: Record<string, boolean> = Object.create(null)
  const restricted = new Set<string>()
  for (const [id, definition] of global.definitions) {
    const local = effective.definitions.get(id)
    const override = isRecord(profile.mcp) ? profile.mcp[id] : undefined
    const sameOverride =
      override === undefined ||
      (isRecord(override) &&
        Object.entries(override).every(
          ([key, value]) =>
            key === 'enabled' || (!!definition && isDeepStrictEqual(definition[key], value))
        ))
    if (!identifiableMcp(definition) || !sameOverride || !isDeepStrictEqual(definition, local)) {
      restricted.add(id)
      continue
    }
    defaults[id] =
      isRecord(override) && typeof override.enabled === 'boolean'
        ? override.enabled
        : (effective.items.find((item) => item.kind === 'mcp' && item.id === id)?.enabled ?? false)
  }
  return { defaults, restricted, nativeIds: [...effective.definitions.keys()] }
}

export async function globalOpenCodeResources(
  env: NodeJS.ProcessEnv = process.env,
  home = homedir()
): Promise<NativeResource[]> {
  const result = await configuredOpenCode(home, env, true)
  return result.items.map((item) => ({
    ...item,
    canToggle: item.kind === 'mcp' && identifiableMcp(result.definitions.get(item.id)),
    ...(item.kind === 'plugin'
      ? { controlReason: 'OpenCode SDK에서 플러그인 실행 상태를 확인하거나 전환할 수 없습니다.' }
      : !identifiableMcp(result.definitions.get(item.id))
        ? { controlReason: '전역 MCP의 실행 대상을 확인할 수 없습니다.' }
        : {}),
    canOpen: result.files.has(item.id)
  }))
}

export async function globalOpenCodeMcpFile(id: string): Promise<string | undefined> {
  return (await configuredOpenCode(homedir(), process.env, true)).files.get(id)
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
