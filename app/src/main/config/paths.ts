// Orca config 루트 경로 헬퍼. 사람이 편집하는 정규 소스(sources/)와 엔진별 배포 산출물(dist/<engine>/)을
// DB/settings 의 <userData> 와 분리해 ~/.config/orca 아래 둔다 (제안서 명시 — 사용자가 직접 편집·버전관리
// 가능한 "설정 소스" 성격). 비밀은 여기 두지 않는다(secret-store 가 <userData> 의 safeStorage 로 보관).
//
// 표준화 계층(arch/backend/standardization.md §5.1):
//   ~/.config/orca/
//   ├── orca.json                # 앱 전역 설정(agent/provider/authToken/baseUrl/env/models).
//   ├── sources/                 # 사람이 편집하는 단일 원천 (instructions/AGENTS.md · skills · agents ·
//   │   └── mcp/mcp.json         #   commands · mcp/mcp.json · hooks/<engine>) — 레이아웃은 deployer/
//   └── dist/<engine>/           #   migrate-sources 가 root 기준으로 구성한다.
//
// 본 파일은 *다른 모듈이 실제로 참조하는* 경로만 노출한다(미사용 sources*/dist* 서브 게터는 제거됨 —
// 레이아웃 구성은 deploy/deployer.ts · config/migrate-sources.ts 가 root 기준 join 으로 담당).
// 런타임에서 claude 어댑터가 로드하는 로컬 플러그인 루트는 dist/<engine>/ 다.

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Backend } from '../../shared/ipc'

// 모든 OS 동일하게 ~/.config/orca (제안서 §환경구성). Windows 에서도 homedir() 하위로 통일.
export function orcaConfigDir(): string {
  return join(homedir(), '.config', 'orca')
}

// 정규 소스 루트(사람 편집 SSOT).
export function sourcesDir(): string {
  return join(orcaConfigDir(), 'sources')
}

// Orca 앱 자체 전역 설정 파일. sources/ 는 엔진별 배포 리소스 SSOT 이고, orca.json 은
// 앱 부팅 시 1회 로드되는 전역 agent/provider 설정이다.
export function orcaJsonPath(): string {
  return join(orcaConfigDir(), 'orca.json')
}

export function sourcesMcpDir(): string {
  return join(sourcesDir(), 'mcp')
}

// MCP 정규 소스. mcp/mcp.json = 순정 Claude mcpServers 스키마 + ${VAR} 플레이스홀더(평문 비밀 0).
export function mcpJsonPath(): string {
  return join(sourcesMcpDir(), 'mcp.json')
}

// 배포 산출물 루트(ExtensionDeployer 생성, 편집 금지). claude 로컬 플러그인 루트 = dist/claude-code/.
export function distDir(engine: Backend): string {
  return join(orcaConfigDir(), 'dist', engine)
}

// 부팅 시 1회. mkdir -p 의미 (recursive). 이미 있으면 무시.
export async function ensureConfigDir(): Promise<void> {
  await mkdir(orcaConfigDir(), { recursive: true })
}
