// 플러그인 패키지 manifest 스키마 (0157).
//
// built-in 도 **같은 manifest 를 통과한다** — provider 별 우회 등록로를 만들지 않는다
// (AUTH-PLAT-012). manifest 는 설치 게이트가 아니라 **등록 위생**(중복·ABI·capability·origin
// 선언)을 위한 빌드 타임 계약이다. 신뢰 경계는 빌드가 담당한다(런타임 로딩 없음).
//
// 목적이 "악의적 플러그인 방어" 가 아니라 **provider 오설정 조기 발견** 이라는 점이 0157 개정의
// 핵심이다 — 미선언 origin 으로 요청하면 런타임에 조용히 새는 대신 등록/실행 시점에 막힌다.

import { z } from 'zod'

const IdSchema = z
  .string()
  .min(1)
  .max(128)
  // 케밥 소문자 — 비밀 네임스페이스 키에 그대로 쓰이므로 구분자 오염을 막는다.
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id 는 케밥 소문자여야 합니다')

// origin 만 받는다(경로·쿼리 금지). policy 판정이 origin 단위라 여기서 형태를 강제한다.
const OriginSchema = z.string().refine((raw) => {
  try {
    const url = new URL(raw)
    return (url.protocol === 'https:' || url.protocol === 'http:') && raw === url.origin
  } catch {
    return false
  }
}, 'allowedOrigins 는 경로 없는 origin 이어야 합니다 (예: https://adfs.corp)')

export const AuthMechanismSchema = z.enum([
  'adfs_browser_session',
  'oauth_browser',
  'oauth_device_code',
  'api_key',
  'auth_token',
  'personal_access_token',
  'basic',
  'external_secret'
])

export const AuthCapabilitySchema = z.enum([
  'browser_session',
  'status',
  'refresh',
  'logout',
  'device_code'
])

export const CredentialPresentationSchema = z.discriminatedUnion('location', [
  z.object({
    location: z.literal('header'),
    name: z.string().min(1).max(128),
    scheme: z.enum(['Bearer', 'Basic', 'Token', 'Raw']).optional()
  }),
  z.object({ location: z.literal('cookie'), name: z.string().min(1).max(128) }),
  // query 노출은 로그·referrer 로 새기 쉬워 리터럴 true 를 요구하는 명시 opt-in 으로만 허용.
  z.object({
    location: z.literal('query'),
    name: z.string().min(1).max(128),
    restricted: z.literal(true)
  })
])

export const AuthProviderContributionSchema = z.object({
  id: IdSchema,
  apiVersion: z.literal(1),
  label: z.string().min(1).max(200),
  targets: z.array(z.enum(['application', 'connector'])).min(1),
  mechanisms: z.array(AuthMechanismSchema).min(1),
  capabilities: z.array(AuthCapabilitySchema).default([]),
  allowedOrigins: z.array(OriginSchema).default([]),
  sessionGroup: IdSchema.optional(),
  loginTimeoutMs: z.number().int().positive().max(3_600_000).optional()
})

export const ConnectorContributionSchema = z.object({
  id: IdSchema,
  apiVersion: z.literal(1),
  label: z.string().min(1).max(200),
  acceptedAuthProviders: z.array(IdSchema).min(1),
  baseUrl: OriginSchema,
  presentation: CredentialPresentationSchema
})

export const PluginManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  version: z.string().min(1).max(64),
  contributes: z
    .object({
      authProviders: z.array(AuthProviderContributionSchema).default([]),
      connectors: z.array(ConnectorContributionSchema).default([])
    })
    .default({ authProviders: [], connectors: [] })
})

export type AuthProviderContribution = z.infer<typeof AuthProviderContributionSchema>
export type ConnectorContribution = z.infer<typeof ConnectorContributionSchema>
export type PluginManifest = z.infer<typeof PluginManifestSchema>

// 현재 registry 가 받아들이는 ABI 버전. 불일치는 등록 단계에서 거부된다 (AUTH-PLAT-014).
export const AUTH_PLUGIN_API_VERSION = 1

export interface ManifestParseFailure {
  ok: false
  errors: string[]
}
export interface ManifestParseSuccess {
  ok: true
  manifest: PluginManifest
}

export function parsePluginManifest(raw: unknown): ManifestParseSuccess | ManifestParseFailure {
  const parsed = PluginManifestSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    }
  }
  const manifest = parsed.data
  const errors: string[] = []

  // sessionGroup 없이 browser_session 을 선언하면 어떤 cookie jar 를 쓸지 결정할 수 없다.
  for (const provider of manifest.contributes.authProviders) {
    if (provider.capabilities.includes('browser_session') && !provider.sessionGroup) {
      errors.push(`${provider.id}: browser_session capability 는 sessionGroup 선언이 필요합니다`)
    }
    if (
      provider.capabilities.includes('device_code') &&
      !provider.mechanisms.includes('oauth_device_code')
    ) {
      errors.push(
        `${provider.id}: device_code capability 는 oauth_device_code mechanism 이 필요합니다`
      )
    }
  }

  // connector 가 같은 패키지 밖 provider 를 참조하는 것은 허용한다(재사용이 목적) — 실재 여부는
  // registry 가 전체 등록을 마친 뒤 판정한다. 여기서는 자기 참조 오타만 잡는다.
  const dupProvider = firstDuplicate(manifest.contributes.authProviders.map((p) => p.id))
  if (dupProvider) errors.push(`authProviders 내 중복 id: ${dupProvider}`)
  const dupConnector = firstDuplicate(manifest.contributes.connectors.map((c) => c.id))
  if (dupConnector) errors.push(`connectors 내 중복 id: ${dupConnector}`)

  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest }
}

function firstDuplicate(ids: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return null
}
