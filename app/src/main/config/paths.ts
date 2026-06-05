// Orca config 루트 경로 헬퍼. 사람이 편집하는 정규 소스(sources/)와 엔진별 배포 산출물(dist/<engine>/)을
// DB/settings 의 <userData> 와 분리해 ~/.config/orca 아래 둔다 (제안서 명시 — 사용자가 직접 편집·버전관리
// 가능한 "설정 소스" 성격). 비밀은 여기 두지 않는다(secret-store 가 <userData> 의 safeStorage 로 보관).
//
// 표준화 계층(arch/backend/standardization.md §5.1):
//   ~/.config/orca/
//   ├── sources/                 # 사람이 편집하는 단일 원천 (SSOT)
//   │   ├── instructions/AGENTS.md
//   │   ├── skills/ · agents/ · commands/
//   │   ├── mcp/mcp.json         # 벤더 중립(순정 Claude mcpServers 스키마 + ${VAR})
//   │   └── hooks/<engine>/      # 표준 없음 → 엔진별 분리
//   └── dist/<engine>/           # ExtensionDeployer 생성물 (편집 금지)
//
// 런타임에서 claude 어댑터가 로드하는 로컬 플러그인 루트는 dist/<engine>/ 다(sources/ 가 아니다 —
// sources/ 는 cross-engine 콘텐츠(opencode hooks 등)를 담으므로 claude 로더에 직접 노출하지 않는다).

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Backend } from '../../shared/ipc'

// 모든 OS 동일하게 ~/.config/orca (제안서 §환경구성). Windows 에서도 homedir() 하위로 통일.
export function orcaConfigDir(): string {
  return join(homedir(), '.config', 'orca')
}

// ── 정규 소스(sources/) — 사람이 편집하는 SSOT ───────────────────────────────

export function sourcesDir(): string {
  return join(orcaConfigDir(), 'sources')
}

export function sourcesInstructionsDir(): string {
  return join(sourcesDir(), 'instructions')
}

// instructions SSOT (AGENTS.md — AAIF/Linux Foundation 표준).
export function agentsMdPath(): string {
  return join(sourcesInstructionsDir(), 'AGENTS.md')
}

export function skillsDir(): string {
  return join(sourcesDir(), 'skills')
}

export function agentsDir(): string {
  return join(sourcesDir(), 'agents')
}

export function commandsDir(): string {
  return join(sourcesDir(), 'commands')
}

export function sourcesMcpDir(): string {
  return join(sourcesDir(), 'mcp')
}

// MCP 정규 소스. mcp/mcp.json = 순정 Claude mcpServers 스키마 + ${VAR} 플레이스홀더(평문 비밀 0).
export function mcpJsonPath(): string {
  return join(sourcesMcpDir(), 'mcp.json')
}

// hook 은 cross-tool 표준이 없어 엔진별로 분리 보관(변환 없이 복사만 — standardization.md §2).
export function sourcesHooksDir(engine: Backend): string {
  return join(sourcesDir(), 'hooks', engine)
}

// ── 배포 산출물(dist/<engine>/) — ExtensionDeployer 생성, 편집 금지 ───────────

export function distDir(engine: Backend): string {
  return join(orcaConfigDir(), 'dist', engine)
}

export function distPluginManifestDir(engine: Backend): string {
  return join(distDir(engine), '.claude-plugin')
}

export function distSkillsDir(engine: Backend): string {
  return join(distDir(engine), 'skills')
}

export function distAgentsDir(engine: Backend): string {
  return join(distDir(engine), 'agents')
}

export function distCommandsDir(engine: Backend): string {
  return join(distDir(engine), 'commands')
}

export function distHooksDir(engine: Backend): string {
  return join(distDir(engine), 'hooks')
}

// 부팅 시 1회. mkdir -p 의미 (recursive). 이미 있으면 무시.
export async function ensureConfigDir(): Promise<void> {
  await mkdir(orcaConfigDir(), { recursive: true })
}
