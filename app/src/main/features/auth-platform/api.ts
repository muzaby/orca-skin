// 내부 API 구현 (0178) — `contracts/internal-api.ts` 의 유일한 구현.
//
// 계약이 **앱 안의 다른 모듈이 인증을 쓰는 표면**이고, 이 파일이 그것을 채운다. 호출자가 아는
// 것은 **대상 이름 하나**뿐이다 — 그 이름으로 인증 레코드를 찾고, 레코드 종류에 따라 ⓐ vault 의
// secret 을 presentation 대로 심거나 ⓑ 브라우저 세션의 cookie jar 로 보낸다. 여기 밖에서는
// 아무도 raw secret 을 만지지 않는다.
//
// **만료 판정을 여기서도 반영한다** — 401 은 "이 요청이 실패했다" 가 아니라 "이 레코드가 더는
// 유효하지 않다" 는 사실이다. 0178 이전에는 그 사실이 어디에도 기록되지 않아, 세션이 끊긴 뒤에도
// 레코드가 `valid` 로 남아 화면이 "연결됨" 이라고 거짓말했다.

import type { AuthBindingInfo } from '../../../shared/ipc'
import type { BrowserSessionCapability } from '../../contracts/auth-method'
import type { ConnectorRuntime } from '../../contracts/connector'
import type {
  InternalApi,
  InternalApiRequest,
  InternalApiResponse
} from '../../contracts/internal-api'
import {
  applyPresentation,
  type AuthenticatedFetchDeps,
  type PreparedRequest,
  type SendOptions
} from '../../infra/auth/authenticated-fetch'
import { authBindingPrefix, type CredentialVault } from '../../infra/auth/credential-vault'
import { locationOf, redirectLocationOf } from '../../infra/auth/net-response'
import type { BindingStore } from './bindings'
import { checkOutboundRequest, checkRedirect, type PolicyResult } from './policy'

// redirect 추종 상한. 초과는 **오류**다 — 마지막 3xx 를 성공으로 접으면 호출자가 빈 본문을
// 정상 응답으로 읽는다.
export const MAX_REDIRECT_HOPS = 5

export interface AuthApiDeps {
  connectors: { getConnector(connectorId: string): ConnectorRuntime | undefined }
  bindings: BindingStore
  vaultFor: (prefix: string) => CredentialVault
  browserSessions: BrowserSessionCapability
  // credential 요청 전송자 (0173 — 프로덕션은 Chromium `net.fetch`).
  sender: AuthenticatedFetchDeps
  // 레코드 상태가 바뀌었을 때(만료·복호화 실패) 상위에 알린다. 상태 반영과 브로드캐스트는
  // 소유자(broker)가 한다 — api 는 사실만 보고한다.
  onStatus: (bindingId: string, status: AuthBindingInfo['status']) => void
  logger: (event: string, meta?: Record<string, unknown>) => void
}

export class AuthApi implements InternalApi {
  constructor(private readonly deps: AuthApiDeps) {}

  async request(req: InternalApiRequest, signal?: AbortSignal): Promise<InternalApiResponse> {
    const connector = this.deps.connectors.getConnector(req.target)
    if (!connector) throw new Error(`알 수 없는 대상: ${req.target}`)
    const binding = this.deps.bindings.findConnectorBinding(req.target)
    if (!binding) throw new Error(`인증되지 않은 대상: ${req.target}`)

    const url = joinUrl(connector.descriptor.baseUrl, req.path, req.query)
    const verdict = checkOutboundRequest({
      url,
      path: req.path,
      ...(req.headers !== undefined ? { headers: req.headers } : {}),
      connectorId: req.target,
      binding: { id: binding.id, target: binding.target, status: binding.status },
      allowedOrigins: [connector.descriptor.baseUrl]
    })
    if (!verdict.ok) throw policyError(verdict)

    const base: PreparedRequest = {
      url,
      method: req.method,
      headers: { ...(req.headers ?? {}) },
      ...(req.body !== undefined ? { body: req.body } : {})
    }
    const options: SendOptions = {
      ...(req.responseType !== undefined ? { responseType: req.responseType } : {}),
      ...(req.maxBytes !== undefined ? { maxBytes: req.maxBytes } : {})
    }

    // 브라우저 세션 레코드는 값을 주입하지 않는다 — Orca 소유 Session 의 cookie jar 가 그대로
    // 실린다. 0178 이전에는 이 경로가 probe 판정만 돌려주고 **본문이 빈 문자열**이었다. 즉
    // "SSO 로그인으로 REST 를 부른다" 는 실사용이 성립하지 않았다.
    if (binding.artifact.kind === 'browser_session') {
      const handleId = binding.artifact.handleId
      return this.follow(
        base,
        connector.descriptor.baseUrl,
        options,
        binding,
        (request, opts) => this.deps.browserSessions.send(handleId, request, opts, signal),
        (next) => ({ ...next, headers: { ...base.headers } })
      )
    }

    const secret = this.readSecret(binding)
    if (secret === null) throw new Error('대상의 credential 을 읽을 수 없습니다')
    // 같은 대상이 PAT(Bearer)와 ID/비밀번호(Basic)를 함께 받으면 표현이 하나로 고정될 수 없다.
    // 레코드의 mechanism 으로 고르고, 선언에 없으면 기본 presentation 으로 되돌아간다.
    const presentation =
      connector.descriptor.presentations?.[binding.mechanism] ?? connector.descriptor.presentation
    return this.follow(
      applyPresentation(base, presentation, secret),
      connector.descriptor.baseUrl,
      options,
      binding,
      (request, opts) => this.deps.sender.send(request, signal, opts),
      (next) => applyPresentation({ ...next, headers: { ...base.headers } }, presentation, secret)
    )
  }

  // MCP `${BINDING:<대상>}` 해석용. **문서화된 예외** — claude CLI 가 MCP 서버를 spawn 하므로
  // 값이 이 경계를 넘는다. 대신 소유권은 레코드로 일원화된다(회전·만료·로그아웃이 한 곳에서).
  token(target: string): string | null {
    const binding = this.deps.bindings.findConnectorBinding(target)
    if (!binding || binding.status !== 'valid') return null
    // **SSO 로그인은 MCP 에 쓰이지 않는다** (사용자 결정 2026-08-06, 0178).
    //
    // 기술적으로 불가능해서가 아니다 — 사내 창구에서 토큰을 받아 넘기는 길은 있었다. 다만 그
    // 토큰은 MCP 서버가 **뜨는 순간 고정되는 사진 한 장**이라(설정 파일에 값으로 박힌다) 대화
    // 도중 낡으면 그 도구만 조용히 거절당한다. 그 만료를 쫓는 장치를 들이는 대신 지원하지
    // 않는 것으로 정했다. MCP 에 붙이려면 PAT·ID/비밀번호를 쓴다.
    //
    // 여기서 null 을 돌려주면 그 서버는 `dropped` 사유와 함께 배포에서 빠진다 — 조용히
    // 사라지지 않는다(`features/extensions/mcp/convert.ts`).
    if (binding.artifact.kind === 'browser_session') {
      this.deps.logger('auth.binding.not-exportable', {
        target,
        reason: 'sso_not_supported_for_mcp'
      })
      return null
    }
    return this.readSecret(binding)
  }

  readSecret(binding: AuthBindingInfo): string | null {
    const vault = this.deps.vaultFor(authBindingPrefix(binding.id))
    const read = vault.read(RECORD_SECRET_KEY)
    if (read.state === 'found') return read.value
    // 복호화 실패는 부재와 구분해 기록하고 레코드를 unknown 으로 낮춘다 — 조용한 미인증 진행을
    // 막는다.
    if (read.state === 'undecryptable') {
      this.deps.logger('auth.credential.undecryptable', { bindingId: binding.id })
      this.deps.onStatus(binding.id, 'unknown')
    }
    return null
  }

  // `redirect:'manual'` 이라 3xx 는 전송자가 그대로 돌려준다. 여기서 policy 로 Location 을
  // 재검사한 뒤에만 다음 홉을 보낸다 — 허용 밖이면 **요청 자체를 만들지 않으므로** credential 이
  // 그 origin 으로 나가지 않는다.
  private async follow(
    initial: PreparedRequest,
    allowedOrigin: string,
    options: SendOptions,
    binding: AuthBindingInfo,
    send: (req: PreparedRequest, options: SendOptions) => Promise<InternalApiResponse>,
    prepareHop: (next: PreparedRequest) => PreparedRequest
  ): Promise<InternalApiResponse> {
    let request = initial
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
      const response = await send(request, options)
      // 3xx 판정·상대 Location 절대화는 `net-response` 의 정본 한 벌을 쓴다 — credential 이
      // 나갈 다음 홉을 정하는 규칙이라 두 벌이면 갈린다.
      const next = locationOf(response, request.url)
      if (next === null) {
        // Location 이 있는데 절대화에 실패한 3xx 는 "다음 홉 없음" 이 아니라 **깨진 리다이렉트**다.
        if (redirectLocationOf(response) !== null) {
          throw new Error('인증 정책 거부: invalid_redirect')
        }
        this.noteAuthFailure(binding, response.status)
        return response
      }

      const verdict = checkRedirect(next, [allowedOrigin])
      if (!verdict.ok) throw policyError(verdict)

      // 303 과 "GET 이 아닌 요청의 301/302" 는 GET 으로 낮추는 것이 HTTP 규약이다.
      const method = downgradeMethod(response.status, request.method)
      request = prepareHop({
        url: next,
        method,
        headers: {},
        ...(method === initial.method && initial.body !== undefined ? { body: initial.body } : {})
      })
    }
    throw new Error(`인증 정책 거부: too_many_redirects (${MAX_REDIRECT_HOPS} 홉 초과)`)
  }

  // 401 은 이 요청 하나의 실패가 아니라 **레코드가 더는 유효하지 않다**는 사실이다. 403 은
  // 포함하지 않는다 — 인증은 됐고 권한만 없는 경우가 흔해, 그걸 만료로 접으면 멀쩡한 연결이
  // 한 번의 권한 오류로 끊긴다.
  private noteAuthFailure(binding: AuthBindingInfo, status: number): void {
    if (status !== 401 || binding.status !== 'valid') return
    this.deps.logger('auth.binding.expired', { bindingId: binding.id, status })
    this.deps.onStatus(binding.id, 'expired')
  }
}

// vault 키. 인증 방식이 이 이름으로 값을 넣고 api 가 읽는다 (`methods/credential.ts`).
const RECORD_SECRET_KEY = 'secret'

export function joinUrl(baseUrl: string, path: string, query?: Record<string, string>): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  return url.toString()
}

function policyError(verdict: PolicyResult & { ok: false }): Error {
  return new Error(`인증 정책 거부: ${verdict.reason} (${verdict.detail})`)
}

function downgradeMethod(status: number, method: string): string {
  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD') return method
  // 303 은 항상, 301/302 는 관례상 GET 으로 낮춘다. 307/308 은 메서드·본문을 보존한다.
  return status === 303 || status === 301 || status === 302 ? 'GET' : method
}
