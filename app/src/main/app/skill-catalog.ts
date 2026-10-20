import { realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, sep } from 'node:path'
import type { SkillInfo } from '../../shared/ipc'
import { readClaudePluginCatalog } from '../adapters/claude/plugin-catalog'
import { openCodeSkillDirectories, openCodePluginSkillDirectories } from '../adapters/opencode'
import { agentsSkillRoot } from '../features/extensions/common/skills/agents'
import { scanSkills, type SkillScanRoot } from '../features/extensions/common/skills/scan'

/** Display inventory only; deployment continues to use the original roots. */
export async function readSkillCatalog(
  roots: SkillScanRoot[],
  enabled: Record<string, boolean>,
  home = homedir(),
  env: NodeJS.ProcessEnv = process.env
): Promise<SkillInfo[]> {
  let files: { file: string; name: string }[] = []
  try {
    files = readClaudePluginCatalog(home, env.CLAUDE_CONFIG_DIR || join(home, '.claude')).files
  } catch {
    // One unavailable native catalog must not erase the other skill sources.
  }
  const pluginDirectories = await openCodePluginSkillDirectories(home, env).catch(() => [])
  const inventory = await scanSkills(
    [
      ...roots,
      {
        sourceId: 'plugin:claude',
        sourceLabel: 'Claude 플러그인',
        sourceKind: 'adapter',
        rootDir: home,
        files
      },
      ...openCodeSkillDirectories(home, env).map((rootDir): SkillScanRoot => ({
        sourceId: 'adapter:opencode',
        sourceLabel: 'OpenCode 스킬',
        sourceKind: 'adapter',
        rootDir
      })),
      ...pluginDirectories.map((rootDir): SkillScanRoot => ({
        sourceId: 'plugin:opencode',
        sourceLabel: 'OpenCode 플러그인',
        sourceKind: 'adapter',
        rootDir
      })),
      agentsSkillRoot(home, env)
    ],
    enabled
  )
  // Canonical agents entries win over harness symlink aliases to the same installed file.
  const canonical = new Map<string, SkillInfo>()
  const key = (path: string): string => (process.platform === 'win32' ? path.toLowerCase() : path)
  const agentsRoot = await realpath(join(home, '.agents', 'skills')).catch(() =>
    join(home, '.agents', 'skills')
  )
  const lockedPaths = new Set(
    await Promise.all(
      inventory
        .filter((s) => s.sourceId === 'agents')
        .map(async (s) => key(await realpath(s.skillPath).catch(() => s.skillPath)))
    )
  )
  const ordered = [
    ...inventory.filter((s) => s.sourceId !== 'agents'),
    ...inventory.filter((s) => s.sourceId === 'agents')
  ]
  for (const skill of ordered) {
    const path = await realpath(skill.skillPath).catch(() => skill.skillPath)
    const child = relative(agentsRoot, path)
    if (
      !isAbsolute(child) &&
      child !== '..' &&
      !child.startsWith(`..${sep}`) &&
      !lockedPaths.has(key(path))
    )
      continue
    canonical.set(key(path), skill)
  }
  return [...canonical.values()].sort(
    (a, b) => a.sourceLabel.localeCompare(b.sourceLabel) || a.name.localeCompare(b.name)
  )
}
