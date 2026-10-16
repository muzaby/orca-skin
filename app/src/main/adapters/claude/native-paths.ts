import { homedir } from 'node:os'
import path from 'node:path'
import type { ContextEnvLookup } from './context-policy'

/** One native root for history and the resources consumed by this harness. */
export function claudeNativePaths(
  lookup: ContextEnvLookup = (key) => process.env[key],
  home = homedir(),
  cwd = process.cwd()
): { root: string; projects: string; plans: string; skills: string; settings: string } {
  const configured = lookup('CLAUDE_CONFIG_DIR')?.trim()
  let root = configured || path.join(home, '.claude')
  if (root === '~') root = home
  else if (/^~[\\/]/.test(root)) root = path.join(home, root.slice(2))
  root = path.resolve(cwd, root)
  return {
    root,
    projects: path.join(root, 'projects'),
    plans: path.join(root, 'plans'),
    skills: path.join(root, 'skills'),
    settings: path.join(root, 'settings.json')
  }
}
