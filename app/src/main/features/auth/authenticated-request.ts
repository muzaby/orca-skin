// 인증된 요청 (0181 `api.ts` → 0188 분리) — 정책 통과 → 자격증명 주입 → 전송 →
// (redirect 재검사) → 401/403 강등.
//
// **0188 이 여기서 뺀 두 표면**:
//   `materialize()` — env/header 물질화. 환경변수 이름·ModelProvider URL·서비스별 header 조립은
//                     Auth 의 지식이 아니다. 소비 feature 가 자기 형상을 만든다.
//   `token()`       — raw 조회. `secret-access.ts` 의 trusted-main 포트로 격리했다.
//
// 남은 것은 **인증된 전송 하나**다. HTTP credential presentation 은 여기 안에 유지된다 —
// 그것은 "어떻게 인증해서 보내는가" 이지 소비자의 형상이 아니다.
//
// **electron 을 import 하지 않는다** — 전송은 `fetchImpl`(Chromium `netFetch`)과
// `BrowserSessionPort`(cookie jar)를 주입받는다. 기본값을 두지 않는 이유는 0173 과 같다:
// 기본값은 곧 조용한 Node 스택 복귀다.

import type {
  AuthDefinition,
  AuthenticatedRequest,
  AuthenticatedResponse,
  AuthId,
  AuthMethod,
  AuthMethodKind,
  Grant,
  Presentation
} from '../../contracts/auth'
import type { PreparedRequest, SendOptions, SendResult } from '../../infra/net/transport'
import { createSender } from '../../infra/net/transport'
import { applyPresentation } from './present'
import { checkOutboundRequest, checkRedirect } from './policy'
import type { AuthRegistry } from './registry'
import type { AuthStore } from './store'
import type { BrowserSessionPort } from './specs/browser-session'
import { ifPresent } from '../../../shared/obj'

// redirect 추종 상한. 홉마다 정책을 다시 보므로 무한 루프는 안 나지만, 루프 자체는 막는다.
const MAX_REDIRECTS = 5

// 이 요청이 무엇을 싣고 나가는가 — 체인 전체에서 한 번만 정해지는 값이다.
//
// `grant` 는 **해석 시점의 grant 객체**다. 홉 사이에 store 가 바뀌었는지를 이 참조로 판정한다
// (`AuthStore.isCurrentGrant` 주석에 근거). 타입을 갈라 두면 세션 carrier 에 값형 grant 가
// 들어가는 불가능 상태를 컴파일 타임에 막는다 — 런타임 비용은 0이다.
type SessionGrant = Extract<Grant, { kind: 'session' }>
type ValueGrant = Exclude<Grant, { kind: 'session' }>

type Carrier =
  | { kind: 'session'; grant: SessionGrant; sessions: BrowserSessionPort; sessionGroup: string }
  | { kind: 'value'; grant: ValueGrant; presentation: Presentation; secret: string }

// ── 후보 자격증명 (r5) ────────────────────────────────────────────────────────
//
// 로그인 probe 는 **아직 아무 데도 커밋되지 않은 값**으로 나간다. r4 까지는 반대였다 —
// `settleGrant` 가 grant 를 전역 store 에 넣고 vault 를 덮은 **뒤에** probe 했고, 그래야
// `checkOutboundRequest` 의 `grantStatus === 'valid'` 를 통과했다. 그 사이(네트워크 왕복 동안)
// 다른 소비자가 검증되지 않은 후보 secret 과 올라간 revision 을 읽었고, probe 가 401 이면
// 강등 이벤트가 나가 Plugin 도구가 회수됐다 — rollback 은 상태만 되돌릴 뿐 그 이벤트를
// 취소하지 못해 도구가 회수된 채로 남았다. 앱이 probe 중 죽으면 vault 에 후보 값이 남았다.
//
// 그래서 후보를 **요청 인자로** 싣는다. store 는 확인이 끝날 때까지 아무것도 모른다.
export interface CandidateCredential {
  grant: Grant
  // 값형: vault 에 아직 쓰지 않은 메모리 값. 세션형은 cookie jar 가 나르므로 없다.
  secret?: string
}

export class AuthPolicyError extends Error {
  constructor(
    readonly reason: string,
    detail: string
  ) {
    super(`요청이 거부됐습니다 (${reason}: ${detail})`)
    this.name = 'AuthPolicyError'
  }
}

export interface AuthenticatedRequesterDeps {
  registry: AuthRegistry
  store: AuthStore
  // **필수** (0173) — 기본값 `fetch` 를 두면 사내 프록시·사설 CA 를 못 타는 Node 스택으로
  // 조용히 나간다. 프로덕션은 `netFetch`(Chromium), 테스트는 스텁.
  fetchImpl: typeof fetch
  // 세션 grant 의 전송 경로. 미주입이면 세션 Auth 의 요청은 거부된다.
  sessions?: BrowserSessionPort
  logger?: (event: string, data: Record<string, unknown>) => void
  // 401/403 관측 시의 강등 통지 (0188). 구 `onChange` 는 "무언가 바뀌었다" 였고 소비자가
  // 무엇이 바뀌었는지 몰랐다 — 여기서는 **어느 Auth 가** 강등됐는지까지 말한다.
  //
  // `credentialChanged` 는 이 관측이 **실제 만료 전이를 만들었는가** 다 (r4). 동시에 떠 있던 두
  // 요청이 각각 401 을 받으면 두 번째 `markExpired` 는 아무것도 바꾸지 않는데, 그때도 true 로
  // 내면 Harness cache 가 한 번 더 비고 도구가 한 번 더 sync 된다. **통지 자체는 계속 낸다** —
  // 전이가 없어도 `verified` 는 풀리므로 화면은 그 사실을 받아야 한다.
  onUnauthorized?: (authId: AuthId, credentialChanged: boolean) => void
  // 시계 기반 만료를 **이 경로에서 처음 관측했을 때**의 통지 (r3). 요청은 정책 단계에서 이미
  // 거부되지만, 그것만으로는 grant 상태가 정착되지 않아 도구 등록·GUI·Harness cache 가 다음
  // snapshot 조회 전까지 살아 있는 것처럼 남았다.
  onExpired?: (authId: AuthId) => void
}

export class AuthenticatedRequester {
  private readonly sender: ReturnType<typeof createSender>

  constructor(private readonly deps: AuthenticatedRequesterDeps) {
    this.sender = createSender(deps.fetchImpl)
  }

  async request(
    authId: AuthId,
    req: AuthenticatedRequest,
    signal?: AbortSignal,
    // 확인 중인 후보. 주어지면 store·vault 를 **읽지도 쓰지도 않는다** (r5).
    candidate?: CandidateCredential
  ): Promise<AuthenticatedResponse> {
    const definition = this.deps.registry.get(authId)
    if (!definition) throw new AuthPolicyError('unknown_auth', authId)

    // 정책 판정 **전에** 시계 만료를 정착시킨다 — `status()` 는 순수 조회라 `expired` 를
    // 돌려주기만 하고 전이를 남기지 않는다. 여기서 못 박아야 거부와 downstream 무효화가
    // 같은 사건이 된다. 이미 정착됐으면 아무 일도 하지 않는다(store 가 1회를 보장).
    //
    // **후보 요청은 지나가지 않는다** — 커밋된 grant 의 만료는 이 요청과 무관하고, 여기서
    // 정착시키면 확인 중인 로그인이 기존 연결을 건드리게 된다.
    if (!candidate && this.deps.store.settleExpiry(authId)) this.deps.onExpired?.(authId)

    const url = withQuery(new URL(req.path, `${definition.origin}/`), req.query)
    const verdict = checkOutboundRequest({
      url,
      path: req.path,
      ...(req.headers ? { headers: req.headers } : {}),
      allowedOrigins: [definition.origin],
      // 후보는 "지금 확인하려는 값" 이라 정의상 valid 다 — 커밋 전이므로 store 에는 없다.
      grantStatus: candidate ? 'valid' : this.deps.store.status(authId)
    })
    if (!verdict.ok) throw new AuthPolicyError(verdict.reason, verdict.detail)

    const prepared: PreparedRequest = {
      url,
      method: req.method ?? 'GET',
      headers: { ...req.headers },
      ...ifPresent('body', req.body)
    }
    // 자격증명(복호화·presentation 해석)은 **요청당 한 번** 푼다 — 홉마다 다시 풀면 홉 수만큼
    // vault 파일 읽기·복호화가 붙는다.
    //
    // **그러나 grant 가 그대로인지는 홉마다 확인한다**(`send()`). 체인 도중에 해제·재인증·401
    // 강등·만료가 끼어들 수 있다 — 요청은 `await` 를 포함하고 `LoginService.revoke()` 는 IPC 에서
    // 동기로 들어온다. 그 확인은 메모리 판정이라 vault 를 다시 읽지 않는다.
    const carrier = this.resolveCarrier(definition, candidate)
    // 401 판정이 **어느 세대의 자격증명**에 대한 것인지 적어 둔다 (r8) — 아래 강등이 이 값을
    // 확인한다.
    const revisionAtSend = this.deps.store.credentialRevision(authId)
    const { result, finalUrl } = await this.send(
      definition,
      carrier,
      prepared,
      req,
      signal,
      candidate
    )

    // 401 은 "자격증명이 더 이상 유효하지 않다" 는 **서버의 판정**이다. 여기서 강등해야
    // 사용자가 GUI 에서 재인증 지점을 본다 — 조용히 실패만 반복하지 않는다.
    //
    // **후보는 강등하지 않는다** (r5) — 커밋된 것이 없으므로 내릴 상태가 없다. 후보의 401 은
    // 그냥 "이 값이 거부됐다" 이고, 그 해석은 로그인 흐름이 자기 실패 모양으로 만든다.
    if (!candidate && (result.status === 401 || result.status === 403)) {
      const changed = this.deps.store.markExpired(authId, revisionAtSend)
      this.deps.logger?.('auth.request.unauthorized', {
        authId,
        status: result.status
      })
      // 아무것도 안 바뀌었으면 방송하지 않는다 — 같은 401 을 두 요청이 각각 봐도 상태는
      // 한 번만 달라진다.
      if (changed.snapshotChanged) {
        this.deps.onUnauthorized?.(authId, changed.credentialChanged)
      }
    }

    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      finalUrl,
      headers: result.headers,
      body: result.body,
      ...ifPresent('bodyBytes', result.bodyBytes)
    }
  }

  // redirect 는 **호출자(여기)가** 돈다 — 홉마다 정책을 재검사해야 자격증명이 allowlist 밖으로
  // 실려 나가지 않는다(`createSender` 는 `redirect:'manual'` 로 멈춰 준다).
  //
  // 최종 URL 을 함께 돌려준다 — probe 판정(체인이 Auth origin 으로 복귀했는가)이 이 값을
  // 본다(`contracts/auth.ts` `AuthenticatedResponse.finalUrl`).
  private async send(
    definition: AuthDefinition,
    carrier: Carrier,
    prepared: PreparedRequest,
    req: AuthenticatedRequest,
    signal?: AbortSignal,
    candidate?: CandidateCredential
  ): Promise<{ result: SendResult; finalUrl: string }> {
    const allowed = this.redirectOrigins(definition, carrier)
    const options: SendOptions = {
      ...ifPresent('responseType', req.responseType),
      ...ifPresent('maxBytes', req.maxBytes)
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
        this.deps.logger?.('auth.request.redirect-blocked', { authId: definition.id })
        throw new AuthPolicyError(redirectCheck.reason, redirectCheck.detail)
      }
      // **다음 홉을 보내기 직전**에 grant 가 그대로인지 본다(첫 홉은 방금 `resolveCarrier` 가
      // 풀었으므로 볼 것이 없다). 해제·재인증·강등·만료가 이 사이에 일어나면 이미 손에 든
      // 자격증명은 더 이상 유효하지 않다 — 홉마다 다시 풀던 시절에는 이 판정이 공짜로 따라왔다.
      // 후보는 store 에 없으므로 홉 사이 변경을 볼 대상 자체가 없다 — 다른 IPC 가 건드릴 수
      // 없는 로그인 턴 지역 값이다.
      if (!candidate && !this.grantStillValid(definition.id, carrier)) {
        this.deps.logger?.('auth.request.grant-changed', { authId: definition.id })
        throw new AuthPolicyError('grant_not_valid', '요청 도중 자격증명이 바뀌었습니다')
      }
      current = { ...current, url: next }
    }
  }

  // 홉이 오갈 수 있는 origin. 요청의 **시작점**은 언제나 `definition.origin` 하나지만(위
  // `checkOutboundRequest`), 세션 grant 의 체인은 IdP 를 거쳐 돌아오는 것이 정상이다 —
  // SSO 배포는 인증에 성공해도 probe 가 302 로 로그인 URL 을 가리키고 WS-Fed/SAML 왕복을 다시
  // 태운다(0174 실기). 그 홉을 `definition.origin` 만으로 막으면 **인증 성공 판정이 영원히
  // 나오지 않는다**. 그래서 세션일 때만 그 세션이 이미 선언한 allowlist 를 더한다.
  //
  // 값형 grant 에는 넓히지 않는다 — 자격증명이 실린 요청이 다른 host 로 따라가면 안 된다.
  private redirectOrigins(definition: AuthDefinition, carrier: Carrier): readonly string[] {
    if (carrier.kind !== 'session') return [definition.origin]
    const spec = definition.methods.find((candidate) => candidate.kind === 'browser-session')
    return spec?.kind === 'browser-session'
      ? [definition.origin, ...spec.config.allowedOrigins]
      : [definition.origin]
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
  private grantStillValid(authId: AuthId, carrier: Carrier): boolean {
    return carrier.kind === 'session'
      ? this.deps.store.isCurrentGrant(authId, carrier.grant)
      : this.deps.store.isCurrentUnexpiredGrant(authId, carrier.grant)
  }

  // 무엇을 어떻게 실어 보낼지를 한 번에 정한다. 세션이면 cookie jar, 값형이면 secret+present.
  private resolveCarrier(definition: AuthDefinition, candidate?: CandidateCredential): Carrier {
    const grant = candidate ? candidate.grant : this.deps.store.get(definition.id)
    if (grant?.kind === 'session') {
      if (!this.deps.sessions) {
        throw new AuthPolicyError('unsupported', '브라우저 세션 전송이 배선되지 않았습니다')
      }
      // 세션 grant 는 값이 아니라 cookie jar 다 — 주입할 secret 이 없고, 전송 경로가 다르다.
      return {
        kind: 'session',
        grant,
        sessions: this.deps.sessions,
        sessionGroup: grant.sessionGroup
      }
    }

    // 후보는 vault 를 아직 안 거쳤으므로 메모리 값을 그대로 쓴다.
    const secret = candidate ? (candidate.secret ?? null) : this.deps.store.secret(definition.id)
    const presentation = presentationFor(
      definition,
      candidate ? candidate.grant.authKind : this.deps.store.authKind(definition.id)
    )
    // `grant` 가 없으면 `secret()` 도 null 이라 아래에서 걸린다 — 값형 grant 임이 여기서 확정된다.
    if (grant === undefined || secret === null || presentation === null) {
      throw new AuthPolicyError(
        'grant_not_valid',
        candidate ? 'candidate' : this.deps.store.status(definition.id)
      )
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
}

// 쿼리는 경로와 분리해 받으므로 여기서 한 번만 붙인다 — origin 은 바뀌지 않는다.
function withQuery(url: URL, query: Record<string, string> | undefined): string {
  if (!query) return url.toString()
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value)
  return url.toString()
}

// 활성 방식의 `present` 선언을 찾는다. 방식마다 싣는 방법이 다르므로 grant 의 방식을 따라간다.
function presentationFor(
  definition: AuthDefinition,
  authKind: AuthMethodKind | null
): Presentation | null {
  if (authKind === null) return null
  const spec = definition.methods.find((candidate) => candidate.kind === authKind)
  return spec ? presentationOf(spec) : null
}

function presentationOf(spec: AuthMethod): Presentation | null {
  return spec.kind === 'browser-session' ? null : spec.present
}
