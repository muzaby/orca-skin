// 두 인증 체계가 공유하는 manual redirect 추종. 전송 방식·자격증명은 호출자가 소유한다.
import type { AuthenticatedResponse } from '../../contracts/auth'
import type { PreparedRequest, SendOptions, SendResult } from '../../infra/net/transport'
import { ifPresent } from '../../../shared/obj'
import { AuthPolicyError } from './auth-policy-error'
import { checkRedirect } from './policy'

export const MAX_REDIRECTS = 5

export function withQuery(url: URL, query: Record<string, string> | undefined): string {
  if (query) {
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value)
  }
  return url.toString()
}

interface RequestChain {
  prepared: PreparedRequest
  options: SendOptions
  allowedOrigins: readonly string[]
  transport(request: PreparedRequest, options: SendOptions): Promise<SendResult>
  beforeNextHop?: () => void
  onBlocked?: () => void
}

export async function followRedirects({
  prepared,
  options,
  allowedOrigins,
  transport,
  beforeNextHop,
  onBlocked
}: RequestChain): Promise<{ result: SendResult; finalUrl: string }> {
  let current = prepared
  for (let hop = 0; ; hop++) {
    const result = await transport(current, options)
    const location = result.headers['location']
    const isRedirect = result.status >= 300 && result.status < 400
    if (!isRedirect || location === undefined) return { result, finalUrl: current.url }
    if (hop >= MAX_REDIRECTS) return { result, finalUrl: current.url }

    const next = new URL(location, current.url).toString()
    const redirectCheck = checkRedirect(next, allowedOrigins)
    if (!redirectCheck.ok) {
      onBlocked?.()
      throw new AuthPolicyError(redirectCheck.reason, redirectCheck.detail)
    }
    beforeNextHop?.()
    current = { ...current, url: next }
  }
}

export function toAuthenticatedResponse({
  result,
  finalUrl
}: {
  result: SendResult
  finalUrl: string
}): AuthenticatedResponse {
  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    finalUrl,
    headers: result.headers,
    body: result.body,
    ...ifPresent('bodyBytes', result.bodyBytes)
  }
}
