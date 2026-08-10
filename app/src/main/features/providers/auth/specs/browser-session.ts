// 브라우저 세션 인증 방식 (0181 — 0180 이 지운 `methods/browser-session.ts` 복원·개정).
//
// ── 전제 (사용자 확인 2026-07-31, 2026-08-10 재확인) ─────────────────────────
// 폐쇄망 사내 앱은 첫 로그인에서 WIA 로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 **동일한
// Electron partition** 을 써서 ADFS 쿠키를 재사용한다. 중앙 OAuth OBO 나 KCD 가 아니다.
//
// ── "둘 다 필요" 의 구체 형태 (사용자 2차 결정) ──────────────────────────────
//   ① 게이트 로그인    — 창이 doneUrlPrefix 에 도달 → probe 로 판정 → `session` grant
//   ② 토큰이 필요한 곳 — `config.exchange` 가 선언돼 있으면 **그 세션의 cookie jar 로** 사내
//      API 를 불러 토큰을 받아 `token` grant 로 승격한다. 표준 OAuth 왕복이 아니라 세션 교환이다.
//
// **electron 을 import 하지 않는다** — 창·세션은 포트로 주입받는다(`BrowserSessionPort`).
// 그래야 이 파일이 vitest 대상으로 남는다(P29: electron 을 무는 파일은 테스트가 즉시 죽는다).

import type { ProviderFailureReason } from '../../../../../shared/ipc'
import type { Provider, SessionTokenExchange, TokenValue } from '../../../../contracts/provider'
import type { BrowserProbeResult } from '../../../../infra/browser-session-policy'
import type { PreparedRequest, SendOptions, SendResult } from '../../../../infra/net/transport'
import type { AuthResult, BrowserSessionSpec, SessionAuthenticator } from '../login'

// `BrowserSessionStore`(infra, electron 의존)가 구조적으로 만족하는 포트.
export interface BrowserSessionPort {
  register(policy: {
    sessionGroup: string
    allowedOrigins: readonly string[]
    allowIntegratedAuthDomains?: readonly string[]
  }): void
  acquire(sessionGroup: string): string
  openLoginWindow(
    handleId: string,
    opts: { url: string; isDone(url: string): boolean }
  ): Promise<{ finalUrl: string }>
  probe(handleId: string, url: string): Promise<BrowserProbeResult>
  send(handleId: string, req: PreparedRequest, options?: SendOptions): Promise<SendResult>
}

export interface SessionRunnerDeps {
  sessions: BrowserSessionPort
  logger?: (event: string, data: Record<string, unknown>) => void
  clock?: () => number
}

function failure(reason: ProviderFailureReason, message: string): AuthResult {
  return { kind: 'failed', reason, message }
}

// 응답 JSON 에서 점 경로로 값을 꺼낸다. 실값(0181 OQ2)이 미정이라 경로를 **선언으로 받는** 것이
// 이 함수의 존재 이유다 — 배포마다 `access_token` 이기도 하고 `data.token` 이기도 하다.
export function pickPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, source)
}

// 만료 표기는 배포마다 초/밀리초/ISO 로 갈린다. 초로 보이는 값은 밀리초로 올린다 —
// 2001년 이전(epoch 1e12 미만)의 만료는 현실에 없다.
export function normalizeExpiry(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 1e12 ? Math.round(raw * 1000) : Math.round(raw)
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

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
      return failure('cancelled', messageOf(error))
    }

    // **doneUrlPrefix 도달만으로 성공을 선언하지 않는다.** 로그인 폼이 같은 접두사로 렌더되는
    // 배포가 있어, 실제 요청으로 한 번 더 확인한다(0157 D1 의 목적).
    let probe: BrowserProbeResult
    try {
      probe = await this.deps.sessions.probe(handleId, config.authenticationProbeUrl)
    } catch (error) {
      return failure('unsupported', messageOf(error))
    }
    if (!probe.ok) {
      this.deps.logger?.('providers.session.probe.unauthenticated', {
        providerId: provider.id,
        status: probe.status
      })
      return failure('cancelled', '로그인이 완료되지 않았습니다')
    }

    if (!config.exchange) {
      return { kind: 'session', sessionGroup: config.sessionGroup }
    }
    return this.exchange(provider, handleId, config.exchange)
  }

  // ② 세션 → 토큰. **origin 밖으로 나가지 않는다** — `path` 는 provider.origin 기준 상대 경로다.
  private async exchange(
    provider: Provider,
    handleId: string,
    exchange: SessionTokenExchange
  ): Promise<AuthResult> {
    const url = new URL(exchange.path, `${provider.origin}/`).toString()
    let result: SendResult
    try {
      result = await this.deps.sessions.send(handleId, {
        url,
        method: 'GET',
        headers: { accept: 'application/json' }
      })
    } catch (error) {
      return failure('exchange_failed', messageOf(error))
    }
    if (result.status < 200 || result.status >= 300) {
      return failure('exchange_failed', `토큰 교환이 ${result.status} 로 실패했습니다`)
    }

    let payload: unknown
    try {
      payload = JSON.parse(result.body)
    } catch {
      return failure('exchange_failed', '토큰 응답이 JSON 이 아닙니다')
    }
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
    const token: TokenValue = { token: value, ...(expiresAt !== undefined ? { expiresAt } : {}) }
    return { kind: 'token', token }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
