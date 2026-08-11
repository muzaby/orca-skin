// OAuth 실행기 (0181) — 순수부(`oauth.ts`)가 만든 PKCE·state 를 실제 redirect 3분기에 태운다.
//
// **electron 을 import 하지 않는다.** 창 열기·외부 브라우저 실행은 포트로 주입받는다
// (컴포지션 루트가 concrete 를 준다) — 그래야 이 파일이 vitest 대상으로 남는다.
//
// 분기별 책임:
//   - `loopback` — 기본 브라우저로 authorize URL 을 열고, 127.0.0.1 리스너가 콜백을 받는다.
//     **가장 안전한 분기**다(사용자가 주소창과 인증서를 직접 본다). RFC 8252 권장.
//   - `window`   — 앱 내부 창. 폐쇄망 IdP 가 루프백 redirect 를 등록해주지 않을 때 쓴다.
//   - `manual`   — 코드 붙여넣기. 리다이렉트를 아예 못 쓰는 환경의 최후 수단.

import type { ProviderFailureReason } from '../../../../shared/ipc'
import type { AuthCtx, OAuthStart, PkcePair, Provider } from '../../../contracts/provider'
import {
  awaitLoopbackCallback,
  loopbackRedirectUri,
  LoopbackCancelledError
} from '../../../infra/loopback-callback'
import type { AuthResult, OAuthAuthenticator, OAuthSpec } from './login'
import {
  challengeFor,
  createPkce,
  createState,
  parseCallbackUrl,
  statesMatch,
  type OAuthStateStore,
  type PendingAuthorization
} from './oauth'

// 앱 내부 창 포트 — 단계 3 의 `infra/browser-session.ts` 가 구현을 준다. 미주입이면
// `window` 분기는 `unsupported` 로 실패한다(조용히 다른 분기로 대체하지 않는다).
export interface AuthWindowPort {
  // `isDone(url)` 이 참인 URL 에 도달하면 그 URL 을 돌려준다. 사용자가 창을 닫으면 null.
  open(opts: { url: string; isDone(url: string): boolean }): Promise<string | null>
}

export interface OAuthRunnerDeps {
  states: OAuthStateStore
  // 기본 브라우저로 URL 열기(`shell.openExternal`).
  openExternal: (url: string) => Promise<void>
  window?: AuthWindowPort
  // 루프백 리스너 — 테스트가 대체할 수 있도록 포트로 둔다.
  listen?: typeof awaitLoopbackCallback
  logger?: (event: string, data: Record<string, unknown>) => void
}

function failure(reason: ProviderFailureReason, message: string): AuthResult {
  return { kind: 'failed', reason, message }
}

export class OAuthRunner implements OAuthAuthenticator {
  private readonly listen: typeof awaitLoopbackCallback

  constructor(private readonly deps: OAuthRunnerDeps) {
    this.listen = deps.listen ?? awaitLoopbackCallback
  }

  async begin(provider: Provider, spec: OAuthSpec): Promise<AuthResult> {
    // PKCE·state 는 **authorize 를 부르기 전에** 발급하고 영속한다 — authorize 안에서
    // ctx 를 부르는 시점과 콜백 도착 시점 사이에 앱이 죽어도 대조가 성립해야 한다(AC4).
    let pkce: PkcePair | null = null
    let state: string | null = null
    let redirectUri: string | undefined
    // 선언이 state 를 **가져갔는가** = authorize URL 에 실었는가. 값의 출처가 `ctx.state()`
    // 하나뿐이라 이 호출이 곧 전송 여부다(`absorbCallback` 의 대조 분기 근거).
    let stateSent = false

    const ctx: AuthCtx = {
      providerId: provider.id,
      pkce: () => (pkce ??= createPkce()),
      state: () => {
        stateSent = true
        return (state ??= createState())
      },
      loopbackRedirectUri: (port) => (redirectUri = loopbackRedirectUri(port))
    }

    let start: OAuthStart
    try {
      start = await spec.authorize(ctx)
    } catch (error) {
      return failure('exchange_failed', messageOf(error))
    }

    // 선언이 ctx 를 안 불렀어도 코어가 채운다 — PKCE 없는 요청이 나가지 않게 한다.
    //
    // **두 폴백의 의미는 다르다.** challenge 는 코어가 채우면 authorize URL 에 실리지 않아도
    // 교환 요청의 verifier 로 살아 있지만, `state` 는 URL 을 **선언이 만들기** 때문에 코어가
    // 채워도 인가 요청에 실리지 않는다. 여기서 채우는 state 는 원장 키일 뿐이고, 실제 전송
    // 여부는 `stateSent` 가 말한다.
    pkce ??= createPkce()
    state ??= createState()
    const pending = this.deps.states.issue({
      providerId: provider.id,
      state,
      stateSent,
      verifier: pkce.verifier,
      ...(redirectUri !== undefined ? { redirectUri } : {})
    })

    switch (start.redirect.kind) {
      case 'manual':
        return { kind: 'code-required', url: start.url }
      case 'loopback':
        return this.runLoopback(provider, start, start.redirect.port, pending)
      case 'window':
        return this.runWindow(provider, start, start.redirect.isDone, pending)
    }
  }

  // manual 분기의 2회차 — 사용자가 붙여 넣은 code 로 교환한다. state 는 브라우저에서 돌아오지
  // 않으므로 providerId 로 pending 을 찾는다.
  async complete(provider: Provider, spec: OAuthSpec, code: string): Promise<AuthResult> {
    const pending = this.deps.states.consume({ providerId: provider.id })
    if (!pending) {
      return failure('cancelled', '진행 중인 인증이 없거나 시간이 지났습니다')
    }
    return this.exchange(provider, spec, code, pending)
  }

  private async runLoopback(
    provider: Provider,
    start: OAuthStart,
    port: number,
    pending: PendingAuthorization
  ): Promise<AuthResult> {
    // 리스너를 먼저 띄운다 — 브라우저를 먼저 열면 아주 빠른 콜백이 닫힌 포트에 닿는다.
    const callback = this.listen({ port })
    try {
      await this.deps.openExternal(start.url)
    } catch (error) {
      void callback.catch(() => undefined)
      return failure('unsupported', messageOf(error))
    }

    let url: string
    try {
      url = await callback
    } catch (error) {
      const reason = error instanceof LoopbackCancelledError ? 'cancelled' : 'unsupported'
      return failure(reason, messageOf(error))
    }
    return this.absorbCallback(provider, start, url, pending)
  }

  private async runWindow(
    provider: Provider,
    start: OAuthStart,
    isDone: (url: string) => boolean,
    pending: PendingAuthorization
  ): Promise<AuthResult> {
    if (!this.deps.window) {
      return failure('unsupported', '앱 내부 인증 창이 배선되지 않았습니다')
    }
    const url = await this.deps.window.open({ url: start.url, isDone })
    if (url === null) return failure('cancelled', '인증 창이 닫혔습니다')
    return this.absorbCallback(provider, start, url, pending)
  }

  // 콜백 URL → code. **state 대조가 여기 한 곳**이라 분기를 늘려도 검사가 늘지 않는다.
  private async absorbCallback(
    provider: Provider,
    start: OAuthStart,
    url: string,
    pending: PendingAuthorization
  ): Promise<AuthResult> {
    const parsed = parseCallbackUrl(url)
    if (parsed.kind === 'error') {
      this.deps.states.consume({ state: pending.state, providerId: provider.id })
      return failure('cancelled', parsed.description ?? parsed.error)
    }
    if (parsed.kind === 'unrelated') {
      return failure('exchange_failed', '콜백에 인가 코드가 없습니다')
    }
    // 대조는 **우리가 state 를 보냈을 때만** 성립한다. `state` 를 명세에 두지 않은 SP 를 상대하는
    // 선언은 `ctx.state()` 를 부르지 않고, 그러면 인가 요청에 state 가 실리지 않아 돌아올 것도
    // 없다 — 그때 없는 state 를 요구하면 그 SP 로는 영원히 로그인할 수 없다. 그 경우의 CSRF
    // 방어는 manual 분기와 같다: "사용자가 방금 이 provider 의 인증을 시작했다" 는 사실 자체가
    // 담당한다(`oauth.ts` 의 `consume` 주석).
    if (pending.stateSent ?? true) {
      // 보냈으면 돌아와야 한다. 없거나 다르면 **거부**한다 — 다른 곳에서 시작된 인가를 이 앱의
      // 세션으로 접붙이려는 시도(CSRF)이기 때문이다. pending 은 남겨 두지 않는다.
      if (parsed.state === null || !statesMatch(pending.state, parsed.state)) {
        this.deps.states.consume({ state: pending.state, providerId: provider.id })
        this.deps.logger?.('providers.oauth.state.mismatch', { providerId: provider.id })
        return failure('state_mismatch', '인증 응답의 state 가 일치하지 않습니다')
      }
    } else if (parsed.state !== null) {
      // 보낸 적 없는 값이 돌아왔다. 대조할 기준이 없으므로 판정에 쓰지 않고 기록만 한다 —
      // 선언이 state 를 실어야 하는데 빠뜨렸을 가능성을 운영자가 볼 수 있게.
      this.deps.logger?.('providers.oauth.state.unsolicited', { providerId: provider.id })
    }
    // 발급한 레코드를 정확히 지운다. 대조를 통과했다면 `parsed.state` 와 같은 값이고, 대조를
    // 건너뛴 경로에서는 이것만이 우리가 아는 키다.
    const consumed = this.deps.states.consume({ state: pending.state, providerId: provider.id })
    if (!consumed) return failure('state_mismatch', '인증 요청을 찾을 수 없습니다')
    return this.exchangeStart(provider, start, parsed.code, consumed)
  }

  private async exchangeStart(
    provider: Provider,
    start: OAuthStart,
    code: string,
    pending: PendingAuthorization
  ): Promise<AuthResult> {
    try {
      const token = await start.exchange(code, pending.verifier)
      return { kind: 'token', token }
    } catch (error) {
      this.deps.logger?.('providers.oauth.exchange.failed', { providerId: provider.id })
      return failure('exchange_failed', messageOf(error))
    }
  }

  // manual 2회차는 `OAuthStart` 를 다시 얻어야 `exchange` 를 부를 수 있다. authorize 를 다시
  // 부르되 **그때 발급되는 pkce·state 는 버리고**(issue 하지 않는다) 보관해 둔 verifier 를 쓴다.
  private async exchange(
    provider: Provider,
    spec: OAuthSpec,
    code: string,
    pending: PendingAuthorization
  ): Promise<AuthResult> {
    let start: OAuthStart
    try {
      start = await spec.authorize({
        providerId: provider.id,
        // 보관된 값을 그대로 돌려준다 — 교환 요청의 verifier 가 인가 요청의 challenge 와
        // 짝이어야 하기 때문이다. challenge 는 verifier 에서 다시 파생하므로 두 번 불러도
        // 같은 값이 나온다(빈 문자열 같은 가짜 값을 흘리지 않는다).
        pkce: () => ({
          verifier: pending.verifier,
          challenge: challengeFor(pending.verifier),
          method: 'S256'
        }),
        state: () => pending.state,
        loopbackRedirectUri: () => pending.redirectUri ?? ''
      })
    } catch (error) {
      return failure('exchange_failed', messageOf(error))
    }
    return this.exchangeStart(provider, start, code, pending)
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
