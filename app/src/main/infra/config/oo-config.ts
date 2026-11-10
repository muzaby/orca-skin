import { reportError, publishErrorReport } from '../error-report'
// main 프로세스 전역 orcinus-orca.json 캐시. 부팅 시 loadOoConfig() 로 1회 로드하고,
// 미로드 상태의 getOoConfig()/appEnv() 호출은 lazy load 로 동일하게 동작한다.

import { DEFAULT_OO_CONFIG, ensureOoFile, readOoFile, type OoConfig } from './oo-file'
import { getLogger } from '../log/registry'

let cached: OoConfig | null = null

function warnAll(warnings: string[]): void {
  for (const warning of warnings) {
    getLogger().child('config').warn('config.orcinus-orca.invalid', { warning })
  }
  if (warnings.length > 0) {
    publishErrorReport({
      title: 'configInvalid',
      detail: warnings[0] + (warnings.length > 1 ? ` 외 ${warnings.length - 1}건` : '')
    })
  }
}

export function loadOoConfig(): OoConfig {
  try {
    ensureOoFile()
    const result = readOoFile()
    warnAll(result.warnings)
    cached = result.config
  } catch (err) {
    reportError({
      event: 'config.orcinus-orca.load-failed',
      scope: 'config',
      title: 'configInvalid',
      level: 'warn',
      error: err,
      data: { message: String(err), fallback: 'defaults' }
    })
    cached = DEFAULT_OO_CONFIG
  }
  return cached
}

export function getOoConfig(): OoConfig {
  return cached ?? loadOoConfig()
}

// 앱 전역 env (미확장 ${VAR} 보존 — 확장/병합은 소비 시점: ipc/chat/send.ts 의 턴 env 조립).
export function appEnv(): Record<string, string> {
  return getOoConfig().env ?? {}
}

// ${VAR} 해석 시 process.env fallback 이 허용되는 이름 목록 (0157). 미지정이면 빈 배열 —
// fallback 없음이 기본값이다.
export function secretEnvAllowlist(): readonly string[] {
  return getOoConfig().secrets?.envAllowlist ?? []
}
