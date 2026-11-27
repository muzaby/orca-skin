import { gitRootLineage } from '../common/git-root'
import { isRecord } from '../../../shared/obj'
import { OoMcpConfigSchema, type OoMcpConfig } from '../common/mcp-config'
import { readClaudeSettingsObjectAsync } from './native-settings-file'
import { claudeProjectSettingsFiles, readClaudeProjectSettings } from './project-settings'
import { pluginPathKey } from './project-path'

// Only the native user's own definition may be promoted into Query options. A
// same-named project or local declaration keeps its own approval and identity.
export async function readClaudeInputDefinitions(
  cwd: string,
  root: string,
  configDirSpecified: boolean,
  choices: Record<string, boolean>
): Promise<OoMcpConfig> {
  const names = Object.keys(choices).filter(
    (key) => key.startsWith('mcp:') && !key.startsWith('mcp:plugin:')
  )
  if (!names.length) return {}
  const [, , , file] = claudeProjectSettingsFiles(cwd, root, configDirSpecified)
  const global = await readClaudeSettingsObjectAsync(file)
  const project = readClaudeProjectSettings(cwd, root, configDirSpecified)
  const own = isRecord(global.mcpServers) ? global.mcpServers : {}
  const projects = isRecord(global.projects) ? global.projects : {}
  const gitRoot = pluginPathKey((await gitRootLineage(cwd)).root)
  const locals = Object.entries(projects).flatMap(([path, entry]) =>
    [gitRoot, pluginPathKey(cwd)].includes(pluginPathKey(path)) &&
    isRecord(entry) &&
    isRecord(entry.mcpServers)
      ? [entry.mcpServers]
      : []
  )
  const result: OoMcpConfig = {}
  for (const key of names) {
    const id = key.slice(4)
    if (
      locals.some((config) => Object.hasOwn(config, id)) ||
      (isRecord(project.definitions.project) && Object.hasOwn(project.definitions.project, id))
    )
      continue
    const definition = own[id]
    if (
      !isRecord(definition) ||
      Object.keys(definition).some(
        (field) => !['type', 'command', 'args', 'env', 'url', 'headers'].includes(field)
      )
    )
      continue
    const parsed = OoMcpConfigSchema.safeParse({ [id]: definition })
    if (parsed.success) result[id] = parsed.data[id]
  }
  return result
}
