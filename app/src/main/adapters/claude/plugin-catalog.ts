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

/** All applicable installations, including disabled entries and distinct paths for one key. */
export function installedClaudePlugins(
  cwd: string,
  installed: unknown
): Array<{ key: string; path: string; scope: string; projectPath?: string }> {
  return Object.entries(record(installed)).flatMap(([key, entries]) => {
    if (!Array.isArray(entries)) return []
    return entries.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.installPath !== 'string' || !entry.installPath.trim())
        return []
      if (entry.scope === 'user' || entry.scope === 'managed')
        return [{ key, path: entry.installPath, scope: entry.scope }]
      if (typeof entry.projectPath !== 'string' || !entry.projectPath.trim()) return []
      const child = relative(pluginPathKey(entry.projectPath), pluginPathKey(cwd))
      const applies =
        entry.scope === 'local'
          ? child === ''
          : entry.scope === 'project' &&
            child !== '..' &&
            !child.startsWith(`..${sep}`) &&
            !isAbsolute(child)
      return applies
        ? [
            {
              key,
              path: entry.installPath,
              scope: String(entry.scope),
              projectPath: entry.projectPath
            }
          ]
        : []
    })
  })
}

/** Runtime loads the most specific applicable installation for each plugin key. */
export function selectClaudePlugins(
  cwd: string,
  installed: unknown,
  enabledPlugins: Record<string, unknown>
): Array<{ key: string; path: string; enabled: boolean; installedOnly: boolean }> {
  const selected = new Map<string, ReturnType<typeof installedClaudePlugins>[number]>()
  const rank = (scope: string): number => ['user', 'project', 'local', 'managed'].indexOf(scope)
  for (const entry of installedClaudePlugins(cwd, installed)) {
    const previous = selected.get(entry.key)
    if (
      !previous ||
      rank(entry.scope) > rank(previous.scope) ||
      (entry.scope === 'project' &&
        previous.scope === 'project' &&
        pluginPathKey(entry.projectPath!).length > pluginPathKey(previous.projectPath!).length)
    )
      selected.set(entry.key, entry)
  }
  return [...selected.values()].map((entry) => {
    const flag = enabledPlugins[entry.key]
    return {
      key: entry.key,
      path: entry.path,
      enabled: flag === true || Array.isArray(flag) || isRecord(flag),
      installedOnly: flag === undefined
    }
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
  files: Array<{ file: string; name: string; enabled: boolean }>
  installations: Array<{ key: string; name: string; path: string; enabled: boolean }>
}

/** A fresh metadata snapshot for the synchronous SDK spawn boundary. No writes/imports. */
export function readClaudePluginCatalog(
  cwd: string,
  nativeRoot = claudeNativePaths().root,
  overrides: Record<string, unknown> = {},
  includeDisabled = false
): ClaudePluginCatalog {
  const projectRoot = claudePluginProjectRoot(cwd)
  const enabled = {
    ...record(readObject(join(nativeRoot, 'settings.json')).enabledPlugins),
    ...record(readObject(join(projectRoot, '.claude', 'settings.json')).enabledPlugins),
    ...record(overrides.enabledPlugins),
    // Explicit workspace plugin choices survive fresh Query flags and provider defaults.
    ...record(readObject(join(projectRoot, '.claude', 'settings.local.json')).enabledPlugins)
  }
  const entries = selectClaudePlugins(
    cwd,
    readObject(join(nativeRoot, 'plugins', 'installed_plugins.json')).plugins,
    enabled
  )
  const roots = new Map<string, string>()
  const skills = new Set<string>()
  const commands = new Map<string, NativeCommand>()
  const filesByName = new Map<string, { file: string; enabled: boolean }>()
  const installations: ClaudePluginCatalog['installations'] = []
  for (const entry of entries) {
    if ((!includeDisabled && !entry.enabled) || !isAbsolute(entry.path) || !exists(entry.path))
      continue
    const root = resolve(entry.path)
    if (roots.has(pluginPathKey(root))) continue
    roots.set(pluginPathKey(root), root)
    const manifest = readObject(join(root, '.claude-plugin', 'plugin.json'))
    const pluginName = typeof manifest.name === 'string' ? manifest.name : basename(root)
    installations.push({ key: entry.key, name: pluginName, path: root, enabled: entry.enabled })
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
        filesByName.set(name, { file, enabled: entry.enabled })
        commands.set(name, {
          name,
          description: (meta.description ?? '').slice(0, 4000),
          argumentHint: (meta['argument-hint'] ?? '').slice(0, 1000),
          source: 'plugin'
        })
      }
    }
  }
  return {
    roots: [...roots.values()],
    skills: [...skills],
    commands: [...commands.values()],
    files: [...filesByName].map(([name, entry]) => ({ name, ...entry })),
    installations
  }
}

export async function configuredClaudeCommands(cwd: string): Promise<NativeCommand[]> {
  return readClaudePluginCatalog(cwd).commands
}
