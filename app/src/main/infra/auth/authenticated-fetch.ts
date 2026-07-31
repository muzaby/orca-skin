// Authenticated fetch 실행부 (0157) — credential 을 요청에 **주입하는 유일한 지점**.
//
// 정책 판정(binding·connector·origin·header spoofing)은 `features/auth-platform/policy.ts` 가
// 순수 함수로 하고, 여기서는 판정을 통과한 요청에 presentation 을 적용해 실제로 보낸다.
// 레이어 DAG 상 infra 는 feature 를 import 할 수 없으므로 credential 조회는 **주입받는다**.
//
// 여기서 만들어진 Request 는 raw secret 을 담지만, 그 값이 호출자에게 되돌아가지 않는다 —
// 반환 타입에 요청 헤더가 없다.

import type { CredentialPresentation } from '../../../shared/ipc'

export interface PreparedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

// presentation 대로 secret 을 심는다. **kind 에서 추론하지 않는다** — 같은 PAT 를 서비스별로
// Bearer / Basic password / PRIVATE-TOKEN 으로 다르게 붙이는 것이 이 함수의 존재 이유다.
//
// 순수 함수 — vitest 대상.
export function applyPresentation(
  req: PreparedRequest,
  presentation: CredentialPresentation,
  secret: string
): PreparedRequest {
  switch (presentation.location) {
    case 'header': {
      return {
        ...req,
        headers: { ...req.headers, [presentation.name]: formatScheme(presentation.scheme, secret) }
      }
    }
    case 'cookie': {
      // 기존 Cookie 헤더를 덮어쓰지 않고 덧붙인다(세션 쿠키와 공존).
      const existing = req.headers['Cookie']
      const pair = `${presentation.name}=${secret}`
      return {
        ...req,
        headers: { ...req.headers, Cookie: existing ? `${existing}; ${pair}` : pair }
      }
    }
    case 'query': {
      const url = new URL(req.url)
      url.searchParams.set(presentation.name, secret)
      return { ...req, url: url.toString() }
    }
  }
}

type HeaderScheme = 'Bearer' | 'Basic' | 'Token' | 'Raw'

function formatScheme(scheme: HeaderScheme | undefined, secret: string): string {
  switch (scheme) {
    case 'Bearer':
      return `Bearer ${secret}`
    case 'Basic':
      // PAT 를 Basic 의 password 로 쓰는 서비스(예: 일부 Atlassian 배포) — 사용자명은 빈 값.
      return `Basic ${Buffer.from(`:${secret}`).toString('base64')}`
    case 'Token':
      return `Token ${secret}`
    case 'Raw':
    case undefined:
      return secret
  }
}

export interface AuthenticatedFetchDeps {
  // 실제 전송자. browser session binding 이면 Orca 소유 Session 의 fetch, static credential 이면
  // 전역 fetch 가 주입된다.
  send(
    req: PreparedRequest,
    signal?: AbortSignal
  ): Promise<{
    status: number
    headers: Record<string, string>
    body: string
  }>
}

export function createSender(): AuthenticatedFetchDeps {
  return {
    async send(req, signal) {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        ...(req.body !== undefined ? { body: req.body } : {}),
        // 인증은 명시 주입으로만 한다 — 암묵적 쿠키 전송을 켜지 않는다.
        credentials: 'omit',
        // allowlist 밖 origin 으로의 redirect 를 따라가지 않는다(정책 우회 방지).
        redirect: 'manual',
        ...(signal ? { signal } : {})
      })
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text()
      }
    }
  }
}
