// `ProviderApi` 구현 (0181) — 앱 안의 다른 모듈이 인증을 쓰는 **단일 포트**의 실체.
//
// 세 표면이 하는 일:
//   - `request`     — 정책 통과 → 자격증명 주입 → 전송 → (redirect 재검사) → 401 강등
//   - `materialize` — LLM subprocess env · 헤더로 물질화. **미인증이면 null**
//   - `token`       — MCP `${BINDING:<대상>}` 용 동기 조회
//
// **electron 을 import 하지 않는다** — 전송은 `fetchImpl`(Chromium `netFetch`)과
// `BrowserSessionPort`(cookie jar)를 주입받는다. 기본값을 두지 않는 이유는 0173 과 같다:
// 기본값은 곧 조용한 Node 스택 복귀다.

import type { ProviderAuthKind } from '../../../../shared/ipc'
import type {
  AuthSpec,
  Presentation,
  Provider,
  ProviderApi,
  ProviderRequest,
  ProviderResponse
} from '../../../contracts/provider'
import type { PreparedRequest, SendOptions, SendResult } from '../../../infra/net/transport'
import { createSender } from '../../../infra/net/transport'
import { applyPresentation } from './present'
import { checkOutboundRequest, checkRedirect } from './policy'
import type { ProviderRegistry } from './registry'
import type { ProviderStore } from './store'
import type { BrowserSessionPort } from './specs/browser-session'

// redirect 추종 상한. 홉마다 정책을 다시 보므로 무한 루프는 안 나지만, 루프 자체는 막는다.
const MAX_REDIRECTS = 5

export class ProviderPolicyError extends Error {
  constructor(
    readonly reason: string,
    detail: string
  ) {
    super(`요청이 거부됐습니다 (${reason}: ${detail})`)
    this.name = 'ProviderPolicyError'
  }
}

export interface ProviderApiDeps {
  registry: ProviderRegistry
  store: ProviderStore
  // **필수** (0173) — 기본값 `fetch` 를 두면 사내 프록시·사설 CA 를 못 타는 Node 스택으로
  // 조용히 나간다. 프로덕션은 `netFetch`(Chromium), 테스트는 스텁.
  fetchImpl: typeof fetch
  // 세션 grant 의 전송 경로. 미주입이면 세션 provider 의 요청은 거부된다.
  sessions?: BrowserSessionPort
  logger?: (event: string, data: Record<string, unknown>) => void
  onChange?: () => void
}

export class ProviderApiImpl implements ProviderApi {
  private readonly sender: ReturnType<typeof createSender>

  constructor(private readonly deps: ProviderApiDeps) {
    this.sender = createSender(deps.fetchImpl)
  }

  async request(
    providerId: string,
    req: ProviderRequest,
    signal?: AbortSignal
  ): Promise<ProviderResponse> {
    const provider = this.deps.registry.get(providerId)
    if (!provider) throw new ProviderPolicyError('unknown_provider', providerId)

    const url = withQuery(new URL(req.path, `${provider.origin}/`), req.query)
    const verdict = checkOutboundRequest({
      url,
      path: req.path,
      ...(req.headers ? { headers: req.headers } : {}),
      allowedOrigins: [provider.origin],
      grantStatus: this.deps.store.status(providerId)
    })
    if (!verdict.ok) throw new ProviderPolicyError(verdict.reason, verdict.detail)

    const prepared: PreparedRequest = {
      url,
      method: req.method ?? 'GET',
      headers: { ...req.headers },
      ...(req.body !== undefined ? { body: req.body } : {})
    }
    const { result, finalUrl } = await this.send(provider, prepared, req, signal)

    // 401 은 "자격증명이 더 이상 유효하지 않다" 는 **서버의 판정**이다. 여기서 강등해야
    // 사용자가 GUI 에서 재인증 지점을 본다 — 조용히 실패만 반복하지 않는다.
    if (result.status === 401 || result.status === 403) {
      this.deps.store.markExpired(providerId)
      this.deps.logger?.('providers.request.unauthorized', {
        providerId,
        status: result.status
      })
      this.deps.onChange?.()
    }

    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      finalUrl,
      headers: result.headers,
      body: result.body,
      ...(result.bodyBytes !== undefined ? { bodyBytes: result.bodyBytes } : {})
    }
  }

  // redirect 는 **호출자(여기)가** 돈다 — 홉마다 정책을 재검사해야 자격증명이 allowlist 밖으로
  // 실려 나가지 않는다(`createSender` 는 `redirect:'manual'` 로 멈춰 준다).
  //
  // 최종 URL 을 함께 돌려준다 — probe 판정(체인이 provider origin 으로 복귀했는가)이 이 값을
  // 본다(`contracts/provider.ts` `ProviderResponse.finalUrl`).
  private async send(
    provider: Provider,
    prepared: PreparedRequest,
    req: ProviderRequest,
    signal?: AbortSignal
  ): Promise<{ result: SendResult; finalUrl: string }> {
    const allowed = this.redirectOrigins(provider)
    let current = prepared
    for (let hop = 0; ; hop++) {
      const result = await this.transport(provider, current, req, signal)
      const location = result.headers['location']
      const isRedirect = result.status >= 300 && result.status < 400
      if (!isRedirect || location === undefined) return { result, finalUrl: current.url }
      if (hop >= MAX_REDIRECTS) return { result, finalUrl: current.url }

      const next = new URL(location, current.url).toString()
      const redirectCheck = checkRedirect(next, allowed)
      if (!redirectCheck.ok) {
        this.deps.logger?.('providers.request.redirect-blocked', { providerId: provider.id })
        throw new ProviderPolicyError(redirectCheck.reason, redirectCheck.detail)
      }
      current = { ...current, url: next }
    }
  }

  // 홉이 오갈 수 있는 origin. 요청의 **시작점**은 언제나 `provider.origin` 하나지만(위
  // `checkOutboundRequest`), 세션 grant 의 체인은 IdP 를 거쳐 돌아오는 것이 정상이다 —
  // SSO 배포는 인증에 성공해도 probe 가 302 로 로그인 URL 을 가리키고 WS-Fed/SAML 왕복을 다시
  // 태운다(0174 실기). 그 홉을 `provider.origin` 만으로 막으면 **인증 성공 판정이 영원히
  // 나오지 않는다**. 그래서 세션일 때만 그 세션이 이미 선언한 allowlist 를 더한다.
  //
  // 값형 grant 에는 넓히지 않는다 — 자격증명이 실린 요청이 다른 host 로 따라가면 안 된다.
  private redirectOrigins(provider: Provider): readonly string[] {
    if (this.deps.store.get(provider.id)?.kind !== 'session') return [provider.origin]
    const spec = provider.auth.find((candidate) => candidate.kind === 'browser-session')
    return spec?.kind === 'browser-session'
      ? [provider.origin, ...spec.config.allowedOrigins]
      : [provider.origin]
  }

  private async transport(
    provider: Provider,
    prepared: PreparedRequest,
    req: ProviderRequest,
    signal?: AbortSignal
  ): Promise<SendResult> {
    const options: SendOptions = {
      ...(req.responseType !== undefined ? { responseType: req.responseType } : {}),
      ...(req.maxBytes !== undefined ? { maxBytes: req.maxBytes } : {})
    }
    const grant = this.deps.store.get(provider.id)
    if (grant?.kind === 'session') {
      if (!this.deps.sessions) {
        throw new ProviderPolicyError('unsupported', '브라우저 세션 전송이 배선되지 않았습니다')
      }
      // 세션 grant 는 값이 아니라 cookie jar 다 — 주입할 secret 이 없고, 전송 경로가 다르다.
      const handleId = this.deps.sessions.acquire(grant.sessionGroup)
      return this.deps.sessions.send(handleId, prepared, options)
    }

    const secret = this.deps.store.secret(provider.id)
    const presentation = presentationFor(provider, this.deps.store.authKind(provider.id))
    if (secret === null || presentation === null) {
      throw new ProviderPolicyError('grant_not_valid', this.deps.store.status(provider.id))
    }
    return this.sender.send(applyPresentation(prepared, presentation, secret), signal, options)
  }

  // LLM `Options.env` · 서비스 헤더 물질화. **미인증이면 null** — 빈 문자열 치환은 인증 없는
  // 요청을 조용히 내보내는 지름길이라 하지 않는다(호출부가 그 키를 드롭한다).
  materialize(
    providerId: string
  ): { env?: Record<string, string>; headers?: Record<string, string> } | null {
    const provider = this.deps.registry.get(providerId)
    if (!provider) return null
    const secret = this.deps.store.secret(providerId)
    if (secret === null) return null

    const out: { env?: Record<string, string>; headers?: Record<string, string> } = {}
    if (provider.llm) out.env = { [provider.llm.envKey]: secret }
    const presentation = presentationFor(provider, this.deps.store.authKind(providerId))
    if (presentation && presentation.location === 'header') {
      const applied = applyPresentation(
        { url: `${provider.origin}/`, method: 'GET', headers: {} },
        presentation,
        secret
      )
      out.headers = applied.headers
    }
    return out.env === undefined && out.headers === undefined ? null : out
  }

  // MCP `${BINDING:<대상>}` 용 — resolver 가 동기라 동기 계약을 유지한다. 세션 grant 는 값이
  // 아니므로 null 이고, 그 서버는 미해결로 배포에서 빠진다(0178 결정 유지).
  token(providerId: string): string | null {
    return this.deps.store.secret(providerId)
  }
}

// 쿼리는 경로와 분리해 받으므로 여기서 한 번만 붙인다 — origin 은 바뀌지 않는다.
function withQuery(url: URL, query: Record<string, string> | undefined): string {
  if (!query) return url.toString()
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value)
  return url.toString()
}

// 활성 방식의 `present` 선언을 찾는다. 방식마다 싣는 방법이 다르므로 grant 의 방식을 따라간다.
function presentationFor(
  provider: Provider,
  authKind: ProviderAuthKind | null
): Presentation | null {
  if (authKind === null) return null
  const spec = provider.auth.find((candidate) => candidate.kind === authKind)
  return spec ? presentationOf(spec) : null
}

function presentationOf(spec: AuthSpec): Presentation | null {
  return spec.kind === 'browser-session' ? null : spec.present
}
