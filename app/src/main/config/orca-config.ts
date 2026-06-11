// main 프로세스 전역 orca.json 캐시. 부팅 시 loadOrcaConfig() 로 1회 로드하고,
// 미로드 상태의 getOrcaConfig()/agentFor() 호출은 lazy load 로 동일하게 동작한다.

import { ensureOrcaFile, readOrcaFile, type OrcaAgentConfig, type OrcaConfig } from './orca-file'

let cached: OrcaConfig | null = null

const DEFAULT_ORCA_CONFIG: OrcaConfig = { version: 1, agents: [] }

function warnAll(warnings: string[]): void {
  for (const warning of warnings) console.warn(`[orca-config] ${warning}`)
}

export function loadOrcaConfig(): OrcaConfig {
  try {
    ensureOrcaFile()
    const result = readOrcaFile()
    warnAll(result.warnings)
    cached = result.config
  } catch (err) {
    console.warn('[orca-config] 로드 실패 — 기본값 사용:', err)
    cached = DEFAULT_ORCA_CONFIG
  }
  return cached
}

export function getOrcaConfig(): OrcaConfig {
  return cached ?? loadOrcaConfig()
}

export function agentFor(adapter: string): OrcaAgentConfig | undefined {
  return getOrcaConfig().agents.find((agent) => agent.adapter === adapter)
}

export function resetOrcaConfigForTest(): void {
  cached = null
}
