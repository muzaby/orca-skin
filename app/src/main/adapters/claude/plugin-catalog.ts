import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { NativeCommand } from '../../../shared/native-resources'
import { isRecord } from '../../../shared/obj'
import { skillMetadata } from '../common/skill-metadata'
import { claudeNativePaths } from './native-paths'

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})
export const pluginPathKey = (value: string): string => {
  const path = resolve(value.replaceAll('\\', '/'))
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function readObject(path: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
    if (!isRecord(value)) throw new Error('invalid object')
    return value
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.')
  }
}

export function claudePluginProjectRoot(cwd: string): string {
  let current = resolve(cwd)
  for (;;) {
    try {
      statSync(join(current, '.git'))
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

/** Shared scope/precedence for the installation menu and session loader. */
export function selectClaudePlugins(
  cwd: string,
  projectRoot: string,
  installed: unknown,
  enabledPlugins: Record<string, unknown>
): Array<{ key: string; path: string; enabled: boolean; installedOnly: boolean }> {
  return Object.entries(record(installed)).flatMap(([key, entries]) => {
    if (!Array.isArray(entries)) return []
    const rank = (entry: Record<string, unknown>): number =>
      ['user', 'project', 'local', 'managed'].indexOf(String(entry.scope))
    const applicable = entries.filter((entry): entry is Record<string, unknown> => {
      if (!isRecord(entry) || typeof entry.installPath !== 'string') return false
      if (entry.scope === 'user' || entry.scope === 'managed') return true
      return (
        (entry.scope === 'project' || entry.scope === 'local') &&
        typeof entry.projectPath === 'string' &&
        [cwd, projectRoot].some(
          (path) => pluginPathKey(path) === pluginPathKey(entry.projectPath as string)
        )
      )
    })
    const entry = applicable.sort((a, b) => rank(b) - rank(a))[0]
    if (!entry) return []
    const flag = enabledPlugins[key]
    return [
      {
        key,
        path: entry.installPath as string,
        enabled: flag === true || Array.isArray(flag) || isRecord(flag),
        installedOnly: flag === undefined
      }
    ]
  })
}

function exists(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function pluginFiles(root: string, path: string, skills: boolean): string[] {
  const child = relative(root, path)
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) return []
  try {
    if (statSync(path).isFile()) return path.endsWith('.md') ? [path] : []
    // Do not follow directory symlinks recursively: plugin trees may contain cycles.
    return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
      const file = join(path, entry.name)
      if (entry.isDirectory()) return pluginFiles(root, file, skills)
      return entry.isFile() && (skills ? entry.name === 'SKILL.md' : entry.name.endsWith('.md'))
        ? [file]
        : []
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error('Claude 플러그인 스킬을 읽을 수 없습니다.')
  }
}

export interface ClaudePluginCatalog {
  roots: string[]
  skills: string[]
  commands: NativeCommand[]
}

/** A fresh metadata snapshot for the synchronous SDK spawn boundary. No writes/imports. */
export function readClaudePluginCatalog(
  cwd: string,
  nativeRoot = claudeNativePaths().root,
  overrides: Record<string, unknown> = {}
): ClaudePluginCatalog {
  const projectRoot = claudePluginProjectRoot(cwd)
  const enabled = {
    ...record(readObject(join(nativeRoot, 'settings.json')).enabledPlugins),
    ...record(readObject(join(projectRoot, '.claude', 'settings.json')).enabledPlugins),
    ...record(readObject(join(projectRoot, '.claude', 'settings.local.json')).enabledPlugins),
    ...record(overrides.enabledPlugins)
  }
  const entries = selectClaudePlugins(
    cwd,
    projectRoot,
    readObject(join(nativeRoot, 'plugins', 'installed_plugins.json')).plugins,
    enabled
  )
  const roots = new Map<string, string>()
  const skills = new Set<string>()
  const commands = new Map<string, NativeCommand>()
  for (const entry of entries) {
    if (!entry.enabled || !isAbsolute(entry.path) || !exists(entry.path)) continue
    const root = resolve(entry.path)
    if (roots.has(pluginPathKey(root))) continue
    roots.set(pluginPathKey(root), root)
    const manifest = readObject(join(root, '.claude-plugin', 'plugin.json'))
    const pluginName = typeof manifest.name === 'string' ? manifest.name : basename(root)
    for (const kind of ['commands', 'skills'] as const) {
      const declaration = manifest[kind]
      const custom =
        typeof declaration === 'string'
          ? [declaration]
          : Array.isArray(declaration)
            ? declaration.filter((item): item is string => typeof item === 'string')
            : []
      const files = new Set(
        [kind, ...custom].flatMap((path) =>
          pluginFiles(root, resolve(root, path), kind === 'skills')
        )
      )
      for (const file of files) {
        let text: string
        try {
          text = readFileSync(file, 'utf8')
        } catch {
          throw new Error('Claude 플러그인 스킬을 읽을 수 없습니다.')
        }
        const meta = skillMetadata(text)
        const localName =
          meta.name ||
          (basename(file) === 'SKILL.md' ? basename(dirname(file)) : basename(file, '.md'))
        const name = `${pluginName}:${localName}`
        skills.add(name)
        if (meta['user-invocable'] === 'false') continue
        commands.set(name, {
          name,
          description: (meta.description ?? '').slice(0, 4000),
          argumentHint: (meta['argument-hint'] ?? '').slice(0, 1000),
          source: 'plugin'
        })
      }
    }
  }
  return { roots: [...roots.values()], skills: [...skills], commands: [...commands.values()] }
}

export async function configuredClaudeCommands(cwd: string): Promise<NativeCommand[]> {
  return readClaudePluginCatalog(cwd).commands
}
