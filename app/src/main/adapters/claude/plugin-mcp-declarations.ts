import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { isRecord } from '../../../shared/obj'
import { readClaudeSettingsObjectAsync } from './native-settings-file'

function pluginFile(root: string, value: string): string | undefined {
  const file = resolve(root, value.replaceAll('${CLAUDE_PLUGIN_ROOT}', root))
  const child = relative(root, file)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child) ? file : undefined
}

export async function readPluginMcpDeclarations(
  root: string,
  manifest: Record<string, unknown>
): Promise<{ value: Record<string, unknown>; file: string }[]> {
  const collected: { value: Record<string, unknown>; file: string }[] = []
  const add = (value: unknown, file: string): void => {
    if (!isRecord(value)) return
    collected.push({ value: isRecord(value.mcpServers) ? value.mcpServers : value, file })
  }
  const bundledFile = join(root, '.mcp.json')
  add(await readClaudeSettingsObjectAsync(bundledFile), bundledFile)
  for (const declaration of Array.isArray(manifest.mcpServers)
    ? manifest.mcpServers
    : [manifest.mcpServers]) {
    if (typeof declaration === 'string') {
      const file = pluginFile(root, declaration)
      if (file) add(await readClaudeSettingsObjectAsync(file), file)
    } else add(declaration, join(root, '.claude-plugin', 'plugin.json'))
  }
  return collected
}
