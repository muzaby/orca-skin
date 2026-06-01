// Orca config 루트 경로 헬퍼. MCP 정의(mcp.json)와 Skill 플러그인 번들은 DB/settings 의
// <userData> 와 분리해 ~/.config/orca 아래 둔다 (제안서 명시 — 사용자가 직접 편집·버전관리 가능한
// "설정 소스" 성격). 비밀은 여기 두지 않는다(secret-store 가 <userData> 의 safeStorage 로 보관).

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

// 모든 OS 동일하게 ~/.config/orca (제안서 §환경구성). Windows 에서도 homedir() 하위로 통일.
export function orcaConfigDir(): string {
  return join(homedir(), '.config', 'orca')
}

export function mcpJsonPath(): string {
  return join(orcaConfigDir(), 'mcp.json')
}

// 확장 정규 레이어. ~/.config/orca 디렉토리 *자체*가 Claude 어댑터 관점의 로컬 플러그인이 된다
// (.claude-plugin/plugin.json 은 어댑터가 생성하는 머티리얼라이즈 산출물). 백엔드-중립 정규 소스인
// skills/ · agents/ · commands/ 가 그 루트에 평면으로 놓인다. mcp.json(점 없음)은 Claude 플러그인
// 로더가 무시하므로 MCP 는 query 옵션으로 별도 주입된다(이중 주입 없음).
export function skillsDir(): string {
  return join(orcaConfigDir(), 'skills')
}

export function agentsDir(): string {
  return join(orcaConfigDir(), 'agents')
}

export function commandsDir(): string {
  return join(orcaConfigDir(), 'commands')
}

// 부팅 시 1회. mkdir -p 의미 (recursive). 이미 있으면 무시.
export async function ensureConfigDir(): Promise<void> {
  await mkdir(orcaConfigDir(), { recursive: true })
}
