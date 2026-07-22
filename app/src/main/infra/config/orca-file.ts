// orca.json 읽기/생성. 파일은 **앱 자체 전역 환경변수**(모든 어댑터 공통 process env 베이스)의
// 정규 소스다 — agent/provider 설정은 handoff 0014 에서 sources/settings/<adapter>/<provider>/
// settings.json 으로 이전됐다 (구 agents[] 필드는 제거 — 클린 브레이크, 발견 시 경고만).
// 부재 시 사용자가 발견·편집할 수 있게 빈 템플릿을 atomic(temp+rename) 생성한다.
// 손상 파일은 절대 덮어쓰지 않고 기본값으로만 동작한다.

import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { orcaJsonPath } from './paths'
import { writeJsonAtomic } from './json-file'

const DisabledUpdateConfigSchema = z.object({
  enabled: z.literal(false),
  provider: z.enum(['github', 'generic', 's3']).optional(),
  owner: z.string().min(1).optional(),
  repo: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  protocol: z.enum(['https', 'http']).optional(),
  url: z.string().url().optional(),
  bucket: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  endpoint: z.string().url().optional(),
  path: z.string().min(1).optional(),
  channel: z.string().min(1).optional()
})

// GitHub (Releases). 폐쇄망은 GitHub Enterprise → host/protocol override 로 base URL 을 바꾼다.
const GithubUpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.literal('github'),
  owner: z.string().min(1),
  repo: z.string().min(1),
  host: z.string().min(1).optional(),
  protocol: z.enum(['https', 'http']).optional(),
  channel: z.string().min(1).optional()
})

const GenericUpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.literal('generic'),
  url: z.string().url(),
  channel: z.string().min(1).optional()
})

// 오브젝트 스토리지(AWS S3 / MinIO 등 S3-호환). endpoint 를 주면 electron-updater 가
// `${endpoint}/${bucket}` 를 generic base URL 로 삼아 사내 MinIO 를 가리킨다(미지정 시 AWS S3).
const S3UpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.literal('s3'),
  bucket: z.string().min(1),
  region: z.string().min(1).optional(),
  endpoint: z.string().url().optional(),
  path: z.string().min(1).optional(),
  channel: z.string().min(1).optional()
})

const UpdateConfigSchema = z.union([
  DisabledUpdateConfigSchema,
  GithubUpdateConfigSchema,
  GenericUpdateConfigSchema,
  S3UpdateConfigSchema
])

const OrcaConfigTopSchema = z.object({
  version: z.literal(1),
  env: z.record(z.string(), z.string()).optional(),
  update: UpdateConfigSchema.optional(),
  debug: z.boolean().optional()
})

export type UpdateConfig = z.infer<typeof UpdateConfigSchema>

export interface OrcaConfig {
  version: 1
  // 앱 전역 env (${VAR} 플레이스홀더 허용 — 확장은 소비 시점). 모든 어댑터 subprocess 에
  // 공통 베이스로 병합된다. provider 별 env 는 settings.json 의 env 블록이 담당.
  env?: Record<string, string>
  // 자동 업데이트 feed override (provider: github|generic|s3, 또는 enabled:false).
  // 폐쇄망은 s3(bucket+endpoint 로 MinIO/S3-호환) 또는 github host(GHE) 로 사내 피드를 가리킨다.
  // token/API key 는 저장하지 않는다.
  update?: UpdateConfig
  // 디버그 로깅 스위치(0144). true 면 prod 설치본도 debug 레벨 로그 전체 + 메시지/턴 이벤트
  // 타임라인(ipc.wire.event, 메시지 본문 제거)을 파일에 남긴다. 미지정/false 면 기존 info 정책.
  // dev 빌드는 항상 debug 라 이 값과 무관(플래그는 prod 에서만 실질 효과).
  debug?: boolean
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
    config: {
      version: 1,
      ...(top.data.env ? { env: top.data.env } : {}),
      ...(top.data.update ? { update: top.data.update } : {}),
      ...(top.data.debug !== undefined ? { debug: top.data.debug } : {})
    },
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
