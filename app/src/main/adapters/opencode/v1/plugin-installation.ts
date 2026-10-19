import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pluginDescription } from '../../common/plugin-description'

export function openCodePluginId(spec: string): string {
  return `plugin:${createHash('sha256').update(spec).digest('hex')}`
}

/** Read installed metadata only; never import a plugin or invoke the package manager. */
export async function openCodePluginInstallation(
  spec: string,
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ directory: string; description?: string } | undefined> {
  try {
    let target: string
    if (spec.startsWith('file:')) target = fileURLToPath(spec)
    else if (isAbsolute(spec) || spec.startsWith('.')) target = resolve(cwd, spec)
    else {
      // OpenCode 1.18.27: Npm.add(package@version) → cache/packages/<spec>/node_modules/<name>.
      // Only registry specs have a deterministic name here; other source types fail closed.
      const match = /^(@[\w.-]+\/[\w.-]+|[\w-][\w.-]*)(?:@([^/\\]+))?$/.exec(spec)
      if (!match || match[1].split('/').some((part) => part === '..' || part === '.')) return
      const name = match[1]
      const versioned = `${name}@${match[2] || 'latest'}`
      const cacheKey =
        process.platform === 'win32'
          ? Array.from(versioned, (char) =>
              /[<>:"|?*]/.test(char) || char.charCodeAt(0) < 32 ? '_' : char
            ).join('')
          : versioned
      const home =
        process.platform === 'win32' ? env.USERPROFILE || homedir() : env.HOME || homedir()
      const cache = resolve(cwd, env.XDG_CACHE_HOME || join(home, '.cache'), 'opencode')
      target = join(cache, 'packages', cacheKey, 'node_modules', name)
    }
    const entry = await stat(target)
    const directory = entry.isDirectory() ? target : entry.isFile() ? dirname(target) : undefined
    if (!directory) return
    const description = await pluginDescription(join(directory, 'package.json'))
    return { directory, ...(description ? { description } : {}) }
  } catch {
    return undefined
  }
}
