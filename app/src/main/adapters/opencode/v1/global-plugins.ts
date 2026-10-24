import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pluginEntries, type PluginEntry } from './openCodePluginConfig'

export function openCodeGlobalConfigFiles(env = process.env, home = homedir()): string[] {
  const root = join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  return ['config.json', 'opencode.json', 'opencode.jsonc'].map((file) => join(root, file))
}

export async function effectiveOpenCodePlugins(
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

export async function openCodeGlobalPluginFingerprint(
  env = process.env,
  home = homedir()
): Promise<string> {
  const { entries } = await effectiveOpenCodePlugins(env, home)
  return JSON.stringify(entries)
}
