// operation 선언 → `AuthenticatedFetchRequest` (순수).
//
// **자리표시자는 허용 목록이다.** 선언에 `{name}` 으로 적힌 이름만 치환되고, 값은 전부
// `encodeURIComponent` 를 거친다 — `/` 나 `?` 가 든 파라미터가 선언된 경로 밖으로 나가지
// 못하게 하는 것이 목적이다(broker 의 origin 검사보다 앞선 1차 방어).

import type { AuthenticatedFetchRequest } from '../../../../contracts/connector-plugin'
import type { UsageConnectorConfig, UsageOperationSpec } from './spec'

const PLACEHOLDER = /\{([A-Za-z0-9_.-]+)\}/g

export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (trimmed === '' || trimmed === '/') return ''
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading
}

// 치환 대상이 없는 파라미터는 **무시한다** — 모델·호출자가 보낸 임의 키가 요청에 새지 않는다.
export function substitute(template: string, params: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = params[name]
    if (value === undefined || value === null) return match
    return encodeURIComponent(String(value))
  })
}

export function buildUsageRequest(
  config: UsageConnectorConfig,
  connectorId: string,
  bindingId: string,
  operation: string,
  params: Record<string, unknown> = {}
): AuthenticatedFetchRequest | null {
  const spec: UsageOperationSpec | undefined = config.operations[operation]
  if (!spec) return null

  const basePath = normalizeBasePath(config.apiBasePath)
  const path = `${basePath}${ensureLeadingSlash(substitute(spec.path, params))}`
  const query = Object.fromEntries(
    Object.entries(spec.query ?? {}).map(([key, value]) => [key, substitute(value, params)])
  )
  const headers = Object.fromEntries(
    Object.entries(spec.headers ?? {}).map(([key, value]) => [key, substitute(value, params)])
  )

  return {
    bindingId,
    connectorId,
    method: spec.method,
    path,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(Object.keys(query).length > 0 ? { query } : {}),
    ...(spec.body !== undefined ? { body: substitute(spec.body, params) } : {})
  }
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}
