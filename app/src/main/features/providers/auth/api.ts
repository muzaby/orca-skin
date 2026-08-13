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
  Grant,
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

// 이 요청이 무엇을 싣고 나가는가 — 체인 전체에서 한 번만 정해지는 값이다.
//
// `grant` 는 **해석 시점의 grant 객체**다. 홉 사이에 store 가 바뀌었는지를 이 참조로 판정한다
// (`ProviderStore.isCurrentGrant` 주석에 근거). 타입을 갈라 두면 세션 carrier 에 값형 grant 가
// 들어가는 불가능 상태를 컴파일 타임에 막는다 — 런타임 비용은 0이다.
type SessionGrant = Extract<Grant, { kind: 'session' }>
type ValueGrant = Exclude<Grant, { kind: 'session' }>

type Carrier =
  | { kind: 'session'; grant: SessionGrant; sessions: BrowserSessionPort; sessionGroup: string }
  | { kind: 'value'; grant: ValueGrant; presentation: Presentation; secret: string }

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
    // 자격증명(복호화·presentation 해석)은 **요청당 한 번** 푼다 — 홉마다 다시 풀면 홉 수만큼
    // vault 파일 읽기·복호화가 붙는다.
    //
    // **그러나 grant 가 그대로인지는 홉마다 확인한다**(`send()`). 체인 도중에 해제·재인증·401
    // 강등·만료가 끼어들 수 있다 — 요청은 `await` 를 포함하고 `LoginService.revoke()` 는 IPC 에서
    // 동기로 들어온다. 그 확인은 메모리 판정이라 vault 를 다시 읽지 않는다.
    const carrier = this.resolveCarrier(provider)
    const { result, finalUrl } = await this.send(provider, carrier, prepared, req, signal)

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
    carrier: Carrier,
    prepared: PreparedRequest,
    req: ProviderRequest,
    signal?: AbortSignal
  ): Promise<{ result: SendResult; finalUrl: string }> {
    const allowed = this.redirectOrigins(provider, carrier)
    const options: SendOptions = {
      ...(req.responseType !== undefined ? { responseType: req.responseType } : {}),
      ...(req.maxBytes !== undefined ? { maxBytes: req.maxBytes } : {})
    }
    let current = prepared
    for (let hop = 0; ; hop++) {
      const result = await this.transport(carrier, current, options, signal)
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
      // **다음 홉을 보내기 직전**에 grant 가 그대로인지 본다(첫 홉은 방금 `resolveCarrier` 가
      // 풀었으므로 볼 것이 없다). 해제·재인증·강등·만료가 이 사이에 일어나면 이미 손에 든
      // 자격증명은 더 이상 유효하지 않다 — 홉마다 다시 풀던 시절에는 이 판정이 공짜로 따라왔다.
      if (!this.grantStillValid(provider.id, carrier)) {
        this.deps.logger?.('providers.request.grant-changed', { providerId: provider.id })
        throw new ProviderPolicyError('grant_not_valid', '요청 도중 자격증명이 바뀌었습니다')
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
  private redirectOrigins(provider: Provider, carrier: Carrier): readonly string[] {
    if (carrier.kind !== 'session') return [provider.origin]
    const spec = provider.auth.find((candidate) => candidate.kind === 'browser-session')
    return spec?.kind === 'browser-session'
      ? [provider.origin, ...spec.config.allowedOrigins]
      : [provider.origin]
  }

  // 홉 사이에 grant 가 바뀌었는가. **carrier 마다 보는 것이 다르다** — 0187 이전의 홉당 동작을
  // 그대로 복원하기 위함이다:
  //
  //   세션 — `store.get()` 뒤 곧바로 cookie jar 로 보냈다. 만료를 보지 않았으므로 여기서도
  //          identity 만 본다(여기에 만료를 더하면 없던 정책이 새로 생긴다).
  //   값형 — `store.secret()` 을 다시 불렀고 그 안에서 만료를 봤다. 그래서 identity + 만료.
  //
  // vault 는 다시 읽지 않는다 — 요청당 1회 snapshot 은 유지된다. 그 대가로 **vault 계층의 중간
  // 변화**(값이 지워지거나 복호화 불가로 바뀌는 것)는 다음 홉에서 보이지 않는다.
  private grantStillValid(providerId: string, carrier: Carrier): boolean {
    return carrier.kind === 'session'
      ? this.deps.store.isCurrentGrant(providerId, carrier.grant)
      : this.deps.store.isCurrentUnexpiredGrant(providerId, carrier.grant)
  }

  // 무엇을 어떻게 실어 보낼지를 한 번에 정한다. 세션이면 cookie jar, 값형이면 secret+present.
  private resolveCarrier(provider: Provider): Carrier {
    const grant = this.deps.store.get(provider.id)
    if (grant?.kind === 'session') {
      if (!this.deps.sessions) {
        throw new ProviderPolicyError('unsupported', '브라우저 세션 전송이 배선되지 않았습니다')
      }
      // 세션 grant 는 값이 아니라 cookie jar 다 — 주입할 secret 이 없고, 전송 경로가 다르다.
      return {
        kind: 'session',
        grant,
        sessions: this.deps.sessions,
        sessionGroup: grant.sessionGroup
      }
    }

    const secret = this.deps.store.secret(provider.id)
    const presentation = presentationFor(provider, this.deps.store.authKind(provider.id))
    // `grant` 가 없으면 `secret()` 도 null 이라 아래에서 걸린다 — 값형 grant 임이 여기서 확정된다.
    if (grant === undefined || secret === null || presentation === null) {
      throw new ProviderPolicyError('grant_not_valid', this.deps.store.status(provider.id))
    }
    return { kind: 'value', grant, presentation, secret }
  }

  private async transport(
    carrier: Carrier,
    prepared: PreparedRequest,
    options: SendOptions,
    signal?: AbortSignal
  ): Promise<SendResult> {
    if (carrier.kind === 'session') {
      const handleId = carrier.sessions.acquire(carrier.sessionGroup)
      return carrier.sessions.send(handleId, prepared, options)
    }
    return this.sender.send(
      applyPresentation(prepared, carrier.presentation, carrier.secret),
      signal,
      options
    )
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
