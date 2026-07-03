// Claude Code plugin package renderer. 사람이 편집하는 sources/를 SDK options.plugins 로 로드 가능한
// dist/claude/plugins/orca/ 패키지로 변환한다. deployer 는 백업/검증/마커를 맡고, 이 모듈은
// Claude plugin 레이아웃 세부(.claude-plugin, skills, agents, hooks, .mcp.json)만 소유한다.

import { chmodSync, cpSync, mkdirSync, readdirSync, writeFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'
import type { Backend, SkillInfo } from '../../shared/ipc'
import type { ClaudeMcpConfig } from '../adapters/mcp-config'
import type { SkillScanRoot } from '../features/extensions/skills/scan'

export const ORCA_PLUGIN_NAME = 'orca'

export const ORCA_PLUGIN_MANIFEST = {
  name: ORCA_PLUGIN_NAME,
  description: 'orca에서 구성된 skill 및 mcp',
  version: '1.0.0'
} as const

export interface ClaudePluginPackageInput {
  engine: Backend
  root: string
  skillRoots: SkillScanRoot[]
  mcpConfig: ClaudeMcpConfig
}

export function orcaPluginRoot(root: string, engine: Backend): string {
  return join(root, 'dist', engine, 'plugins', ORCA_PLUGIN_NAME)
}

export function namespaceOrcaSkill(name: string): string {
  return name.startsWith(`${ORCA_PLUGIN_NAME}:`) ? name : `${ORCA_PLUGIN_NAME}:${name}`
}

export function adaptSkillNameForClaude(skill: SkillInfo): string {
  return skill.sourceKind === 'orca' ? namespaceOrcaSkill(skill.name) : skill.name
}

function copyOrcaSkills(roots: SkillScanRoot[], dest: string): void {
  mkdirSync(dest, { recursive: true })
  for (const root of roots) {
    if (root.sourceKind !== 'orca') continue
    let entries: Dirent[]
    try {
      entries = readdirSync(root.rootDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      cpSync(join(root.rootDir, entry.name), join(dest, entry.name), {
        recursive: true,
        force: true
      })
    }
  }
}

export function renderClaudePluginPackage(input: ClaudePluginPackageInput): string {
  const pluginRoot = orcaPluginRoot(input.root, input.engine)
  const manifestDir = join(pluginRoot, '.claude-plugin')
  const skillsDir = join(pluginRoot, 'skills')
  const agentsDir = join(pluginRoot, 'agents')
  const hooksDir = join(pluginRoot, 'hooks')

  mkdirSync(manifestDir, { recursive: true })
  mkdirSync(agentsDir, { recursive: true })
  mkdirSync(hooksDir, { recursive: true })
  copyOrcaSkills(input.skillRoots, skillsDir)

  writeFileSync(
    join(manifestDir, 'plugin.json'),
    JSON.stringify(ORCA_PLUGIN_MANIFEST, null, 2),
    'utf8'
  )
  const mcpPath = join(pluginRoot, '.mcp.json')
  writeFileSync(mcpPath, JSON.stringify({ mcpServers: input.mcpConfig }, null, 2), 'utf8')
  try {
    chmodSync(mcpPath, 0o600)
  } catch {
    // best-effort: Windows/일부 FS 에서는 POSIX mode 가 의미 없을 수 있다.
  }

  return pluginRoot
}
