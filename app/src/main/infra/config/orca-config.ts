// main 프로세스 전역 orca.json 캐시. 부팅 시 loadOrcaConfig() 로 1회 로드하고,
// 미로드 상태의 getOrcaConfig()/appEnv() 호출은 lazy load 로 동일하게 동작한다.

import { DEFAULT_ORCA_CONFIG, ensureOrcaFile, readOrcaFile, type OrcaConfig } from './orca-file'
import { getLogger } from '../log/registry'

let cached: OrcaConfig | null = null

function warnAll(warnings: string[]): void {
  for (const warning of warnings) {
    getLogger().child('config').warn('config.orca.invalid', { warning })
  }
}

export function loadOrcaConfig(): OrcaConfig {
  try {
    ensureOrcaFile()
    const result = readOrcaFile()
    warnAll(result.warnings)
    cached = result.config
  } catch (err) {
    getLogger()
      .child('config')
      .warn('config.orca.load-failed', { message: String(err), fallback: 'defaults' })
    cached = DEFAULT_ORCA_CONFIG
  }
  return cached
}

export function getOrcaConfig(): OrcaConfig {
  return cached ?? loadOrcaConfig()
}

// 앱 전역 env (미확장 ${VAR} 보존 — 확장/병합은 소비 시점: ipc/chat/send.ts 의 턴 env 조립).
export function appEnv(): Record<string, string> {
  return getOrcaConfig().env ?? {}
}

// ${VAR} 해석 시 process.env fallback 이 허용되는 이름 목록 (0157). 미지정이면 빈 배열 —
// fallback 없음이 기본값이다.
export function secretEnvAllowlist(): readonly string[] {
  return getOrcaConfig().secrets?.envAllowlist ?? []
}
