// orca.json 읽기/생성. 파일은 **앱 자체 전역 환경변수**(모든 어댑터 공통 process env 베이스)의
// 정규 소스다 — agent/provider 설정은 handoff 0014 에서 sources/settings/<adapter>/<provider>/
// settings.json 으로 이전됐다 (구 agents[] 필드는 제거 — 클린 브레이크, 발견 시 경고만).
// 부재 시 사용자가 발견·편집할 수 있게 빈 템플릿을 atomic(temp+rename) 생성한다.
// 손상 파일은 절대 덮어쓰지 않고 기본값으로만 동작한다.

import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { orcaJsonPath } from './paths'
import { writeJsonAtomic } from './json-file'

const OrcaConfigTopSchema = z.object({
  version: z.literal(1),
  env: z.record(z.string(), z.string()).optional()
})

export interface OrcaConfig {
  version: 1
  // 앱 전역 env (${VAR} 플레이스홀더 허용 — 확장은 소비 시점). 모든 어댑터 subprocess 에
  // 공통 베이스로 병합된다. provider 별 env 는 settings.json 의 env 블록이 담당.
  env?: Record<string, string>
}

export interface ParseOrcaFileResult {
  config: OrcaConfig
  warnings: string[]
}

export const DEFAULT_ORCA_CONFIG: OrcaConfig = { version: 1 }

function issueSummary(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')
}

export function parseOrcaFile(raw: string): ParseOrcaFileResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (err) {
    return {
      config: DEFAULT_ORCA_CONFIG,
      warnings: [`orca.json JSON 파싱 실패 — 기본값 사용: ${String(err)}`]
    }
  }

  const top = OrcaConfigTopSchema.safeParse(json)
  if (!top.success) {
    return {
      config: DEFAULT_ORCA_CONFIG,
      warnings: [`orca.json 최상위 스키마 위반 — 기본값 사용: ${issueSummary(top.error)}`]
    }
  }

  const warnings: string[] = []
  // 구 스키마(handoff 0009~0010) 잔존 감지 — 마이그레이션 없이 무시하되 1회 경고로 안내한다.
  if (typeof json === 'object' && json !== null && 'agents' in json) {
    warnings.push(
      'orca.json 의 agents 필드는 제거됐습니다(handoff 0014) — provider 설정은 ' +
        'sources/settings/<adapter>/<provider>/settings.json 으로 이전하세요 (TRD §6.8).'
    )
  }
  return {
    config: { version: 1, ...(top.data.env ? { env: top.data.env } : {}) },
    warnings
  }
}

export function ensureOrcaFile(): void {
  const path = orcaJsonPath()
  if (existsSync(path)) return
  writeJsonAtomic(path, DEFAULT_ORCA_CONFIG)
}

export function readOrcaFile(): ParseOrcaFileResult {
  let raw: string
  try {
    raw = readFileSync(orcaJsonPath(), 'utf8')
  } catch (err) {
    return {
      config: DEFAULT_ORCA_CONFIG,
      warnings: [`orca.json 읽기 실패 — 기본값 사용: ${String(err)}`]
    }
  }
  return parseOrcaFile(raw)
}
