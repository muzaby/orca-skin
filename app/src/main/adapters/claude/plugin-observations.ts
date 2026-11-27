// The SDK can name a plugin whose manifest omits name. The identity belongs to the
// observed installation path, so a registry update never transfers it to another path.
import { pluginPathKey } from './project-path'

const names = new Map<string, string>()

export function observeClaudePluginNames(plugins: readonly { path: string; name: string }[]): void {
  for (const plugin of plugins) names.set(pluginPathKey(plugin.path), plugin.name)
}

export function claudePluginName(
  path: string,
  manifest: Record<string, unknown>
): string | undefined {
  return (
    names.get(pluginPathKey(path)) ||
    (typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name : undefined)
  )
}
