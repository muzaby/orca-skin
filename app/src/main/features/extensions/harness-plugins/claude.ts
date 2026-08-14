// Claude Code plugin package renderer. 사람이 편집하는 sources/를 SDK options.plugins 로 로드 가능한
// dist/claude/plugins/orca/ 패키지로 변환한다. deployer 는 백업/검증/마커를 맡고, 이 모듈은
// Claude plugin 레이아웃 세부(.claude-plugin, skills, agents, hooks, .mcp.json)만 소유한다.

// 동기 fs 금지(0109) — 스킬 재귀 복사가 부팅/CRUD 경로에서 이벤트 루프를 막지 않게 한다.
import { chmod, cp, mkdir, readdir, writeFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../../../shared/ipc'
import { ORCA_PLUGIN_NAME } from '../../../adapters/claude-plugin'
import type { ClaudeMcpConfig } from '../../../adapters/mcp-config'
import type { SkillScanRoot } from '../skills/scan'

const ORCA_PLUGIN_MANIFEST = {
  name: ORCA_PLUGIN_NAME,
  description: 'orca에서 구성된 skill 및 mcp',
  version: '1.0.0'
} as const

interface ClaudeHarnessPluginInput {
  engine: Backend
  root: string
  skillRoots: SkillScanRoot[]
  mcpConfig: ClaudeMcpConfig
}

export function builtInHarnessPluginRoot(root: string, engine: Backend): string {
  return join(root, 'dist', engine, 'plugins', ORCA_PLUGIN_NAME)
}

async function copyOrcaSkills(roots: SkillScanRoot[], dest: string): Promise<void> {
  await mkdir(dest, { recursive: true })
  for (const root of roots) {
    if (root.sourceKind !== 'orca') continue
    let entries: Dirent[]
    try {
      entries = await readdir(root.rootDir, { withFileTypes: true })
    } catch {
      continue
    }
    // 같은 root 안에서 entry.name 은 유일 → 대상 경로가 서로소라 병렬 복사가 안전하다.
    // root 간에는 이름 충돌 시 뒤 root 가 이기는 순서 의미가 있어 루프를 직렬로 유지한다.
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          cp(join(root.rootDir, entry.name), join(dest, entry.name), {
            recursive: true,
            force: true
          })
        )
    )
  }
}

export async function renderClaudeHarnessPlugin(input: ClaudeHarnessPluginInput): Promise<string> {
  const pluginRoot = builtInHarnessPluginRoot(input.root, input.engine)
  const manifestDir = join(pluginRoot, '.claude-plugin')
  const skillsDir = join(pluginRoot, 'skills')
  const agentsDir = join(pluginRoot, 'agents')
  const hooksDir = join(pluginRoot, 'hooks')

  // 디렉토리 4곳은 서로 독립 — 병렬 생성(copyOrcaSkills 가 skillsDir mkdir 를 겸한다).
  await Promise.all([
    mkdir(manifestDir, { recursive: true }),
    mkdir(agentsDir, { recursive: true }),
    mkdir(hooksDir, { recursive: true }),
    copyOrcaSkills(input.skillRoots, skillsDir)
  ])

  const mcpPath = join(pluginRoot, '.mcp.json')
  await Promise.all([
    writeFile(
      join(manifestDir, 'plugin.json'),
      JSON.stringify(ORCA_PLUGIN_MANIFEST, null, 2),
      'utf8'
    ),
    writeFile(mcpPath, JSON.stringify({ mcpServers: input.mcpConfig }, null, 2), 'utf8')
  ])
  try {
    await chmod(mcpPath, 0o600)
  } catch {
    // best-effort: Windows/일부 FS 에서는 POSIX mode 가 의미 없을 수 있다.
  }

  return pluginRoot
}
