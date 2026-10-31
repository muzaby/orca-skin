import { readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { NativeCommand } from '../../../shared/native-resources'
import { isRecord } from '../../../shared/obj'
import { readJsonObject, readJsonObjectSync } from '../../infra/config/json-file'
import { extensionChoices } from '../common/extension-control'
import { gitRootLineage } from '../common/git-root'
import { skillMetadata } from '../common/skill-metadata'
import { claudeNativePaths } from './native-paths'
import { claudePluginEnabled } from './plugin-flag'
import { claudeLocalSettingsRoot, pluginPathKey } from './project-path'
const readObject = (file: string): Record<string, unknown> =>
  readJsonObjectSync(file, () => new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.'))

const readObjectAsync = (file: string): Promise<Record<string, unknown>> =>
  readJsonObject(file, () => new Error('Claude 네이티브 확장 설정을 읽을 수 없습니다.'))

export function claudePluginDefaults(
  nativeRoot: string,
  overrides: Record<string, unknown> = {}
): Record<string, boolean> {
  const defaults = pluginDefaults(readObject(join(nativeRoot, 'settings.json')), overrides)
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, claudePluginEnabled(value)])
  )
}
function pluginDefaults(
  global: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  return { ...record(global.enabledPlugins), ...record(overrides.enabledPlugins) }
}

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})

/** All applicable installations, including disabled entries and distinct paths for one key. */
export function installedClaudePlugins(
  cwd: string,
  installed: unknown,
  globalOnly = false
): Array<{ key: string; path: string; scope: string; projectPath?: string }> {
  return Object.entries(record(installed)).flatMap(([key, entries]) => {
    if (!Array.isArray(entries)) return []
    return entries.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.installPath !== 'string' || !entry.installPath.trim())
        return []
      if (entry.scope === 'user' || entry.scope === 'managed')
        return [{ key, path: entry.installPath, scope: entry.scope }]
      if (globalOnly) return []
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
      enabled: claudePluginEnabled(flag),
      installedOnly: flag === undefined
    }
  })
}

export function claudeInstallationExists(path: string): boolean {
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

async function pluginFilesAsync(root: string, path: string, skills: boolean): Promise<string[]> {
  const child = relative(root, path)
  if (child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) return []
  try {
    if ((await stat(path)).isFile()) return path.endsWith('.md') ? [path] : []
    const entries = await readdir(path, { withFileTypes: true })
    return (
      await Promise.all(
        entries.map(async (entry) => {
          const file = join(path, entry.name)
          if (entry.isDirectory()) return pluginFilesAsync(root, file, skills)
          return entry.isFile() && (skills ? entry.name === 'SKILL.md' : entry.name.endsWith('.md'))
            ? [file]
            : []
        })
      )
    ).flat()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw new Error('Claude 플러그인 스킬을 읽을 수 없습니다.')
  }
}

export interface ClaudePluginCatalog {
  defaults: Record<string, boolean>
  roots: string[]
  skills: string[]
  commands: NativeCommand[]
  files: Array<{
    file: string
    name: string
    enabled: boolean
    text: string
    meta: Record<string, string>
  }>
  installations: Array<{ key: string; name: string; path: string; enabled: boolean }>
}

type PluginEntry = ReturnType<typeof selectClaudePlugins>[number]
interface LoadedPlugin {
  entry: PluginEntry
  manifest: Record<string, unknown>
  files: Array<{ file: string; text: string }>
}

function catalogSelection(
  cwd: string,
  documents: Record<string, unknown>[],
  overrides: Record<string, unknown>,
  includeDisabled: boolean,
  capturedDefaults?: Record<string, boolean>
): { defaults: Record<string, unknown>; entries: PluginEntry[] } {
  const [global, project, local, installed] = documents
  const defaults = capturedDefaults ?? pluginDefaults(global, overrides)
  const enabled = {
    ...defaults,
    ...record(project.enabledPlugins),
    ...record(local.enabledPlugins)
  }
  const roots = new Set<string>()
  const entries = selectClaudePlugins(cwd, installed.plugins, enabled).filter((entry) => {
    if ((!includeDisabled && !entry.enabled) || !isAbsolute(entry.path)) return false
    const key = pluginPathKey(entry.path)
    if (roots.has(key)) return false
    roots.add(key)
    return true
  })
  return { defaults, entries }
}

function declaredPaths(manifest: Record<string, unknown>, kind: 'commands' | 'skills'): string[] {
  const declaration = manifest[kind]
  return [
    kind,
    ...(typeof declaration === 'string'
      ? [declaration]
      : Array.isArray(declaration)
        ? declaration.filter((item): item is string => typeof item === 'string')
        : [])
  ]
}

/** File I/O is outside this projection so menu reads and synchronous SDK spawn agree. */
function projectCatalog(
  defaults: Record<string, unknown>,
  loaded: LoadedPlugin[]
): ClaudePluginCatalog {
  const roots: string[] = []
  const skills = new Set<string>()
  const commands = new Map<string, NativeCommand>()
  const filesByName = new Map<string, Omit<ClaudePluginCatalog['files'][number], 'name'>>()
  const installations: ClaudePluginCatalog['installations'] = []
  for (const { entry, manifest, files } of loaded) {
    const root = resolve(entry.path)
    roots.push(root)
    const pluginName = typeof manifest.name === 'string' ? manifest.name : basename(root)
    installations.push({ key: entry.key, name: pluginName, path: root, enabled: entry.enabled })
    for (const { file, text } of files) {
      const meta = skillMetadata(text)
      const localName =
        meta.name ||
        (basename(file) === 'SKILL.md' ? basename(dirname(file)) : basename(file, '.md'))
      const name = pluginName + ':' + localName
      skills.add(name)
      if (meta['user-invocable'] === 'false') continue
      filesByName.set(name, { file, enabled: entry.enabled, text, meta })
      commands.set(name, {
        name,
        description: (meta.description ?? '').slice(0, 4000),
        argumentHint: (meta['argument-hint'] ?? '').slice(0, 1000),
        source: 'plugin'
      })
    }
  }
  return {
    defaults: Object.fromEntries(
      Object.entries(defaults).map(([key, value]) => [key, claudePluginEnabled(value)])
    ),
    roots,
    skills: [...skills],
    commands: [...commands.values()],
    files: [...filesByName].map(([name, entry]) => ({ name, ...entry })),
    installations
  }
}

function settingsPaths(projectRoot: string, nativeRoot: string): string[] {
  return [
    join(nativeRoot, 'settings.json'),
    join(projectRoot, '.claude', 'settings.json'),
    join(projectRoot, '.claude', 'settings.local.json'),
    join(nativeRoot, 'plugins', 'installed_plugins.json')
  ]
}

/** A fresh metadata snapshot for the synchronous SDK spawn boundary. No writes/imports. */
export function readClaudePluginCatalog(
  cwd: string,
  nativeRoot = claudeNativePaths().root,
  overrides: Record<string, unknown> = {},
  includeDisabled = false,
  capturedDefaults?: Record<string, boolean>
): ClaudePluginCatalog {
  const documents = settingsPaths(claudeLocalSettingsRoot(cwd), nativeRoot).map((file, i) =>
    i === 0 && capturedDefaults ? {} : readObject(file)
  )
  const { defaults, entries } = catalogSelection(
    cwd,
    documents,
    overrides,
    includeDisabled,
    capturedDefaults
  )
  const loaded = entries
    .filter((entry) => claudeInstallationExists(entry.path))
    .map((entry): LoadedPlugin => {
      const root = resolve(entry.path)
      const manifest = readObject(join(root, '.claude-plugin', 'plugin.json'))
      const files = (['commands', 'skills'] as const).flatMap((kind) => [
        ...new Set(
          declaredPaths(manifest, kind).flatMap((path) =>
            pluginFiles(root, resolve(root, path), kind === 'skills')
          )
        )
      ])
      return {
        entry,
        manifest,
        files: files.map((file) => {
          try {
            return { file, text: readFileSync(file, 'utf8') }
          } catch {
            throw new Error('Claude 플러그인 스킬을 읽을 수 없습니다.')
          }
        })
      }
    })
  return projectCatalog(defaults, loaded)
}

export async function readClaudePluginCatalogAsync(
  cwd: string,
  nativeRoot = claudeNativePaths().root,
  overrides: Record<string, unknown> = {},
  includeDisabled = false,
  capturedDefaults?: Record<string, boolean>
): Promise<ClaudePluginCatalog> {
  let projectRoot = resolve(cwd)
  if (process.platform !== 'win32') {
    try {
      projectRoot = (await gitRootLineage(cwd)).root
    } catch {
      throw new Error('Claude 프로젝트 설정을 읽을 수 없습니다.')
    }
  }
  const documents = await Promise.all(
    settingsPaths(projectRoot, nativeRoot).map((file, i) =>
      i === 0 && capturedDefaults ? {} : readObjectAsync(file)
    )
  )
  const { defaults, entries } = catalogSelection(
    cwd,
    documents,
    overrides,
    includeDisabled,
    capturedDefaults
  )
  const loaded = await Promise.all(
    entries.map(async (entry): Promise<LoadedPlugin | null> => {
      if (!(await stat(entry.path).catch(() => null))?.isDirectory()) return null
      const root = resolve(entry.path)
      const manifest = await readObjectAsync(join(root, '.claude-plugin', 'plugin.json'))
      const perKind = await Promise.all(
        (['commands', 'skills'] as const).map(async (kind) => [
          ...new Set(
            (
              await Promise.all(
                declaredPaths(manifest, kind).map((path) =>
                  pluginFilesAsync(root, resolve(root, path), kind === 'skills')
                )
              )
            ).flat()
          )
        ])
      )
      const files = await Promise.all(
        perKind.flat().map(async (file) => {
          try {
            return { file, text: await readFile(file, 'utf8') }
          } catch {
            throw new Error('Claude 플러그인 스킬을 읽을 수 없습니다.')
          }
        })
      )
      return { entry, manifest, files }
    })
  )
  return projectCatalog(
    defaults,
    loaded.filter((entry): entry is LoadedPlugin => entry !== null)
  )
}

export async function configuredClaudeCommands(
  cwd: string,
  choices: Record<string, boolean>
): Promise<NativeCommand[]> {
  return (
    await readClaudePluginCatalogAsync(cwd, undefined, {
      enabledPlugins: extensionChoices(choices, 'plugin')
    })
  ).commands
}
