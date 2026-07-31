// orca.json 읽기/생성. 파일은 **앱 자체 전역 환경변수**(모든 어댑터 공통 process env 베이스)의
// 정규 소스다 — agent/provider 설정은 handoff 0014 에서 sources/settings/<adapter>/<provider>/
// settings.json 으로 이전됐다 (구 agents[] 필드는 제거 — 클린 브레이크, 발견 시 경고만).
// 부재 시 사용자가 발견·편집할 수 있게 빈 템플릿을 atomic(temp+rename) 생성한다.
// 손상 파일은 절대 덮어쓰지 않고 기본값으로만 동작한다.

import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { orcaJsonPath } from './paths'
import { writeJsonAtomic } from './json-file'

// enabled:false 면 업데이터 전체가 꺼져 피드 데이터를 아무도 읽지 않는다 — provider 만 남긴다
// (resolveUpdateFeed 의 provider narrowing 이 이 필드를 요구). 나머지 키는 zod 가 알아서
// strip 하므로, 사용자가 설정을 지우지 않고 enabled 만 false 로 둬도 그대로 파싱된다.
// 0149: provider 별 데이터 필드를 여기 다시 나열하던 것을 제거했다 — 새 필드가 생길 때마다
// 아무도 안 읽는 목록을 따라 갱신해야 했다.
const DisabledUpdateConfigSchema = z.object({
  enabled: z.literal(false),
  provider: z.enum(['github', 'generic', 's3']).optional()
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

// 비밀 해석 정책 (0157). 구 MCP resolver 는 미해결 ${VAR} 를 `process.env` **전체**에서
// 찾았다 — 앱 환경의 임의 값이 이름만 맞으면 MCP 설정으로 샜다. 이제 env fallback 은 여기
// 나열한 **정확한 이름**만 허용한다(패턴·접두사 없음).
const SecretsConfigSchema = z.object({
  envAllowlist: z.array(z.string().min(1)).optional()
})

const OrcaConfigTopSchema = z.object({
  version: z.literal(1),
  env: z.record(z.string(), z.string()).optional(),
  update: UpdateConfigSchema.optional(),
  secrets: SecretsConfigSchema.optional(),
  debug: z.boolean().optional()
})

export type UpdateConfig = z.infer<typeof UpdateConfigSchema>
export type SecretsConfig = z.infer<typeof SecretsConfigSchema>

export interface OrcaConfig {
  version: 1
  // 앱 전역 env (${VAR} 플레이스홀더 허용 — 확장은 소비 시점). 모든 어댑터 subprocess 에
  // 공통 베이스로 병합된다. provider 별 env 는 settings.json 의 env 블록이 담당.
  env?: Record<string, string>
  // 자동 업데이트 feed override (provider: github|generic|s3, 또는 enabled:false).
  // 폐쇄망은 s3(bucket+endpoint 로 MinIO/S3-호환) 또는 github host(GHE) 로 사내 피드를 가리킨다.
  // token/API key 는 저장하지 않는다.
  update?: UpdateConfig
  // 비밀 해석 정책 (0157). `envAllowlist` 에 적은 이름만 `${VAR}` 해석의 process.env
  // fallback 으로 허용된다. 미지정이면 env fallback 이 **전혀 없다**(vault 와 binding 만).
  secrets?: SecretsConfig
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
