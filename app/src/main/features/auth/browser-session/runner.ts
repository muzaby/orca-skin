// 브라우저 세션 로그인 흐름 (0181 → 0188 이설).
//
// 창을 열고 세션·토큰·신원을 만들어 주는 실행기. 선언 표면(`BrowserSessionConfig`)과 전송
// 포트(`BrowserSessionPort`)는 `../specs/browser-session.ts`, Electron partition 구현은
// `infra/browser-session.ts` 가 갖는다 — 디렉토리 이동을 이유로 Electron 구현을 feature 안으로
// 끌어올리지 않는다.
//
// **electron 을 import 하지 않는다** — 창·세션은 포트로 주입받는다. 그래야 vitest 대상이다.

import type { ProviderFailureReason } from '../../../../shared/ipc'
import type {
  Provider,
  SessionLookup,
  SessionTokenExchange,
  TokenValue
} from '../../../contracts/auth'
import { errorMessage } from '../../../infra/errors'
import type { SendResult } from '../../../infra/net/transport'
import type { AuthResult, BrowserSessionSpec, SessionAuthenticator } from '../login'
import {
  normalizeExpiry,
  pickPath,
  pickPrincipal,
  type BrowserSessionPort
} from '../specs/browser-session'

export interface SessionRunnerDeps {
  sessions: BrowserSessionPort
  logger?: (event: string, data: Record<string, unknown>) => void
  clock?: () => number
}

function failure(reason: ProviderFailureReason, message: string): AuthResult {
  return { kind: 'failed', reason, message }
}

// **판정은 여기 없다.** 이 클래스는 창을 열고 세션·토큰·신원을 만들어 줄 뿐이고, 그것이
// 실제로 인증됐는지는 `LoginService` 가 `Provider.probe` 로 확인한다(방식 무관 단일 판정).
// 부팅 복원도 같은 경로라 여기에 `verify` 짝을 두지 않는다 — 두 벌이면 규칙이 갈린다.
export class SessionRunner implements SessionAuthenticator {
  constructor(private readonly deps: SessionRunnerDeps) {}

  async login(provider: Provider, spec: BrowserSessionSpec): Promise<AuthResult> {
    const { config } = spec
    // 같은 group 을 여러 provider 가 선언하면 allowlist 가 합집합으로 넓어진다 — 의도적으로
    // cookie jar 를 공유하는 경우다.
    this.deps.sessions.register({
      sessionGroup: config.sessionGroup,
      allowedOrigins: config.allowedOrigins
    })
    const handleId = this.deps.sessions.acquire(config.sessionGroup)

    try {
      await this.deps.sessions.openLoginWindow(handleId, {
        url: config.loginUrl,
        isDone: (url) => url.startsWith(config.doneUrlPrefix)
      })
    } catch (error) {
      // 사용자가 창을 닫은 것과 정책 위반이 같은 예외로 온다 — 둘 다 재시도 가능한 취소다.
      return failure('cancelled', errorMessage(error))
    }

    // **doneUrlPrefix 도달만으로 성공이 확정되지 않는다** — 로그인 폼이 같은 접두사로 렌더되는
    // 배포가 있다(0157 D1 의 목적). 그 확인은 `LoginService` 가 grant 커밋 뒤 `Provider.probe`
    // 로 한 번에 한다. 여기서는 창이 닫힌 뒤의 조립만 이어간다.
    if (!config.exchange) {
      // 세션에서 끝나는 배포 — 신원은 여기서만 물을 수 있다(교환 응답이 없으므로).
      const principalId = await this.whoami(provider, handleId, config.whoami)
      return {
        kind: 'session',
        sessionGroup: config.sessionGroup,
        ...(principalId !== undefined ? { principalId } : {})
      }
    }
    return this.exchange(provider, handleId, config.exchange, config.whoami)
  }

  // ③ 세션 → 신원 (0182). **표시용 식별자 하나**를 읽어 `Grant.principalId` 로 싣는다.
  //
  // 실패는 전부 `undefined` 로 접는다 — 이 값이 없다고 로그인을 되돌리면 "이름을 못 읽어서
  // 로그인이 안 되는" 상태가 된다. 사유는 로그가 남기고, 화면은 폴백 라벨을 쓴다.
  private async whoami(
    provider: Provider,
    handleId: string,
    lookup: SessionLookup | undefined
  ): Promise<string | undefined> {
    // 미선언이면 요청을 아예 내지 않는다 — 신원을 안 쓰는 배포에 왕복을 물리지 않는다.
    if (!lookup) return undefined

    const read = await this.getJson(provider, handleId, lookup.path)
    if (!read.ok) {
      return this.whoamiFailed(provider, lookup, whoamiReason(read.failure))
    }
    return (
      pickPrincipal(read.payload, lookup.valuePath) ??
      this.whoamiFailed(provider, lookup, '값 없음')
    )
  }

  // 세션 쿠키로 provider origin 안의 JSON 을 한 번 읽는다 — whoami·exchange 가 같은 요청을
  // 낸다(같은 헤더·같은 2xx 판정·같은 JSON 파싱). **실패를 어떤 문장으로 접는지만** 서로
  // 다르므로(whoami 는 로그 한 줄, exchange 는 사용자에게 보이는 사유) 그 결정은 호출부에
  // 남기고 요청은 한 벌만 둔다.
  private async getJson(
    provider: Provider,
    handleId: string,
    path: string
  ): Promise<{ ok: true; payload: unknown } | { ok: false; failure: JsonReadFailure }> {
    const url = new URL(path, `${provider.origin}/`).toString()
    let result: SendResult
    try {
      result = await this.deps.sessions.send(handleId, {
        url,
        method: 'GET',
        headers: { accept: 'application/json' }
      })
    } catch (error) {
      return { ok: false, failure: { kind: 'send', message: errorMessage(error) } }
    }
    if (result.status < 200 || result.status >= 300) {
      return { ok: false, failure: { kind: 'status', status: result.status } }
    }
    try {
      return { ok: true, payload: JSON.parse(result.body) }
    } catch {
      return { ok: false, failure: { kind: 'not-json' } }
    }
  }

  // 실패 사유를 남기고 `undefined` 를 돌려준다. **값은 로그에 싣지 않는다** — principal 은
  // 계정 식별자(대개 email)라 개인정보다. 대신 `valuePath` 를 찍어 오타를 지목한다
  // (exchange 의 `no-token` 로그와 같은 형태).
  private whoamiFailed(provider: Provider, lookup: SessionLookup, reason: string): undefined {
    this.deps.logger?.('providers.session.whoami.failed', {
      providerId: provider.id,
      valuePath: lookup.valuePath,
      reason
    })
    return undefined
  }

  // ② 세션 → 토큰. **origin 밖으로 나가지 않는다** — `path` 는 provider.origin 기준 상대 경로다.
  private async exchange(
    provider: Provider,
    handleId: string,
    exchange: SessionTokenExchange,
    whoamiLookup?: SessionLookup
  ): Promise<AuthResult> {
    const read = await this.getJson(provider, handleId, exchange.path)
    if (!read.ok) return failure('exchange_failed', exchangeReason(read.failure))
    const payload = read.payload
    const value = pickPath(payload, exchange.valuePath)
    if (typeof value !== 'string' || value.length === 0) {
      // 경로를 로그에 남긴다 — 실값 미정(OQ2) 상태에서 배포가 고칠 지점을 지목한다.
      this.deps.logger?.('providers.session.exchange.no-token', {
        providerId: provider.id,
        valuePath: exchange.valuePath
      })
      return failure('exchange_failed', '토큰 응답에서 값을 찾지 못했습니다')
    }
    const expiresAt = exchange.expiresAtPath
      ? normalizeExpiry(pickPath(payload, exchange.expiresAtPath))
      : undefined
    // 교환 응답이 이미 신원을 말했으면 **한 번 더 묻지 않는다**(왕복 0). 없을 때만 whoami 로 간다.
    const principalId =
      (exchange.principalPath ? pickPrincipal(payload, exchange.principalPath) : undefined) ??
      (await this.whoami(provider, handleId, whoamiLookup))
    const token: TokenValue = {
      token: value,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(principalId !== undefined ? { principalId } : {})
    }
    return { kind: 'token', token }
  }
}

// `getJson` 이 실패한 자리. **문장이 아니라 사유**로 돌려 준다 — 같은 요청이지만 whoami 는
// 로그 한 줄로, exchange 는 사용자에게 보이는 문장으로 접기 때문이다.
type JsonReadFailure =
  { kind: 'send'; message: string } | { kind: 'status'; status: number } | { kind: 'not-json' }

// whoami — 진단 로그용 짧은 사유.
function whoamiReason(failure: JsonReadFailure): string {
  switch (failure.kind) {
    case 'send':
      return failure.message
    case 'status':
      return `status ${failure.status}`
    case 'not-json':
      return 'JSON 이 아님'
  }
}

// exchange — 로그인 실패로 화면에 뜨는 문장.
function exchangeReason(failure: JsonReadFailure): string {
  switch (failure.kind) {
    case 'send':
      return failure.message
    case 'status':
      return `토큰 교환이 ${failure.status} 로 실패했습니다`
    case 'not-json':
      return '토큰 응답이 JSON 이 아닙니다'
  }
}
