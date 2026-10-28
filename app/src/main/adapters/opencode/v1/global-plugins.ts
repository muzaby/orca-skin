import { discoveryReadFile as readFile, openCodeDiscovery } from './discovery-cache'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pluginEntries, type PluginEntry } from './openCodePluginConfig'

export function openCodeGlobalConfigFiles(env = process.env, home = homedir()): string[] {
  const root = join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  return ['config.json', 'opencode.json', 'opencode.jsonc'].map((file) => join(root, file))
}

async function readEffectiveOpenCodePlugins(
  env = process.env,
  home = homedir()
): Promise<{
  file?: string
  entries: PluginEntry[]
}> {
  let result: { file?: string; entries: PluginEntry[] } = { entries: [] }
  for (const file of openCodeGlobalConfigFiles(env, home)) {
    try {
      const entries = pluginEntries(await readFile(file, 'utf8'))
      if (entries) result = { file, entries }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return result
}

export function effectiveOpenCodePlugins(
  env = process.env,
  home = homedir()
): ReturnType<typeof readEffectiveOpenCodePlugins> {
  return openCodeDiscovery.run(openCodeDiscovery.key('global', home, env), () =>
    readEffectiveOpenCodePlugins(env, home)
  )
}

export async function openCodeGlobalPluginFingerprint(
  env = process.env,
  home = homedir()
): Promise<string> {
  const { entries } = await effectiveOpenCodePlugins(env, home)
  return JSON.stringify(entries)
}
