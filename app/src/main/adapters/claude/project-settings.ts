import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { claudeNativePaths } from './native-paths'
import { claudePluginProjectRoot, pluginPathKey, claudeLocalSettingsRoot } from './project-path'

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})
const names = (value: unknown): string[] => {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
    throw new Error('프로젝트 확장 설정을 읽을 수 없습니다.')
  return [...value].sort()
}
function read(file: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    if (!isRecord(value)) throw new Error('invalid object')
    return value
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error('프로젝트 확장 설정을 읽을 수 없습니다.')
  }
}
export function claudeProjectSettingsFiles(
  cwd: string,
  nativeRoot = claudeNativePaths().root,
  configDirSpecified = !!process.env.CLAUDE_CONFIG_DIR?.trim() ||
    nativeRoot !== claudeNativePaths().root
): string[] {
  const root = claudeLocalSettingsRoot(cwd)
  return [
    join(root, '.claude/settings.json'),
    join(root, '.claude/settings.local.json'),
    join(root, '.mcp.json'),
    configDirSpecified ? join(nativeRoot, '.claude.json') : join(homedir(), '.claude.json')
  ]
}

export interface ClaudeProjectSettings {
  plugins: Record<string, unknown>
  disabledMcp: string[]
  enabledMcp: string[]
  disabledProjectMcp: string[]
  approvedProjectMcp: string[]
  approveAll: unknown
  definitions: { project: unknown; local: unknown }
  revision: string
  structure: string
}
export function readClaudeProjectSettings(
  cwd: string,
  nativeRoot?: string,
  configDirSpecified?: boolean
): ClaudeProjectSettings {
  const [projectFile, localFile, mcpFile, stateFile] = claudeProjectSettingsFiles(
    cwd,
    nativeRoot,
    configDirSpecified
  )
  const project = read(projectFile)
  const local = read(localFile)
  for (const value of [project, local]) {
    if (value.enabledPlugins !== undefined && !isRecord(value.enabledPlugins))
      throw new Error('프로젝트 확장 설정을 읽을 수 없습니다.')
    for (const key of ['disabledMcpjsonServers', 'enabledMcpjsonServers'])
      if (
        value[key] !== undefined &&
        (!Array.isArray(value[key]) || !value[key].every((item) => typeof item === 'string'))
      )
        throw new Error('프로젝트 확장 설정을 읽을 수 없습니다.')
  }
  const projects = record(read(stateFile).projects)
  const entry = (path: string): Record<string, unknown> =>
    record(
      Object.entries(projects).find(([key]) => pluginPathKey(key) === pluginPathKey(path))?.[1]
    )
  const native = { ...entry(claudePluginProjectRoot(cwd)), ...entry(cwd) }
  const plugins = { ...record(project.enabledPlugins), ...record(local.enabledPlugins) }
  if (
    Object.values(plugins).some(
      (value) => typeof value !== 'boolean' && !Array.isArray(value) && !isRecord(value)
    )
  )
    throw new Error('프로젝트 확장 설정을 읽을 수 없습니다.')
  const data = {
    plugins,
    disabledMcp: names(native.disabledMcpServers),
    enabledMcp: names(native.enabledMcpServers),
    disabledProjectMcp: [
      ...new Set([
        ...names(project.disabledMcpjsonServers),
        ...names(local.disabledMcpjsonServers),
        ...names(native.disabledMcpjsonServers)
      ])
    ].sort(),
    approvedProjectMcp: [
      ...new Set([
        ...names(project.enabledMcpjsonServers),
        ...names(local.enabledMcpjsonServers),
        ...names(native.enabledMcpjsonServers)
      ])
    ].sort(),
    approveAll: local.enableAllProjectMcpServers ?? project.enableAllProjectMcpServers,
    definitions: { project: read(mcpFile).mcpServers, local: native.mcpServers }
  }
  // Hashes never expose server URLs, arguments or credentials to renderer/logs.
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : isRecord(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])])
          )
        : value
  const digest = (value: unknown): string =>
    createHash('sha256')
      .update(JSON.stringify(canonical(value)))
      .digest('hex')
  return { ...data, revision: digest(data), structure: digest(data.definitions) }
}
