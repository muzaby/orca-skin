// Provider 계약 (0181) — 폐쇄망 배포가 채우는 **유일한 선언**이자, 0180 이 지운 계약 3종
// (`auth-method`·`internal-api`·`connector`)의 대체다.
//
// ── 왜 축이 하나인가 ─────────────────────────────────────────────────────────
// 구 구조는 프로토콜 enum(`AuthMechanism`)이 1급 축이라 `AuthMechanism × AuthTargetKind ×
// CredentialPresentation` 이 곱해졌고, 방식이 **별도 레지스트리에 있고 대상이 id 로 참조**해서
// 참조 무결성 검증(`validateCrossReferences`·등록 순서 의존)까지 딸려왔다. 여기서는 `kind` 가
// **관계**(누가 누구를 상대하는가)만 말하고 `AuthSpec` 은 선언 **안에 인라인**이라 참조가 없다.
// 런타임 검사는 둘뿐이다 — 중복 `id`, `origin` 형태(`registry.ts`).
//
// 레이어: contracts → contracts·adapters·infra·shared. 타입 전용이라 런타임 의존이 없다.

import type { ProviderAuthKind, ProviderFieldInfo, ProviderKind } from '../../shared/ipc'
import type { RuntimeToolServer } from '../adapters/runtime-tools'

// ── 자격증명을 요청에 싣는 방법 ────────────────────────────────────────────────
//
// **kind 에서 추론하지 않는다** — 같은 PAT 를 서비스별로 Bearer / Basic password /
// PRIVATE-TOKEN 으로 다르게 붙이는 것이 이 선언의 존재 이유다(구 `authenticated-fetch.ts`).
export interface Presentation {
  location: 'header' | 'query' | 'cookie'
  name: string
  // 'raw' = 값 그대로. 'basic' 은 값이 이미 `user:pass` 형태임을 전제하고 base64 로 감싼다.
  scheme?: 'bearer' | 'basic' | 'token' | 'raw'
}

export type FieldSpec = ProviderFieldInfo

// 입력 수집형 3종이 공유하는 형상. `compose` 는 입력 레코드를 vault 에 넣을 **한 문자열**로
// 접는다 — 값이 하나냐 둘이냐의 차이는 이 함수 안에만 있다.
interface CredentialSpecBase {
  label: string
  fields: readonly FieldSpec[]
  present: Presentation
  compose(input: Record<string, string>): ComposeResult
}

export type ComposeResult = { value: string; principalId?: string } | { error: string }

// ── OAuth (code→token) ────────────────────────────────────────────────────────
//
// PKCE·`state` 는 **코어가 제공**한다(`ctx`). provider 마다 달라질 여지가 없는 진짜 공통이고,
// 각자에게 맡기면 한 곳만 빼먹어도 조용히 취약해진다.
export interface AuthCtx {
  providerId: string
  // RFC 7636 — verifier 는 코어가 보관하고, 선언은 challenge 만 authorize URL 에 싣는다.
  pkce(): PkcePair
  // CSRF 대조용 난수. 코어가 **파일에 보관**하므로 앱이 재시작돼도 콜백 대조가 성립한다.
  state(): string
  // 루프백 redirect 를 쓸 때의 실제 redirect_uri. `redirect.kind==='loopback'` 에서만 유효하다.
  loopbackRedirectUri(port: number): string
}

export interface PkcePair {
  verifier: string
  challenge: string
  method: 'S256'
}

export type OAuthRedirect =
  // 앱 내부 창에서 흐름을 끝낸다 — `isDone` 이 참인 URL 에 도달하면 code 를 뽑는다.
  | { kind: 'window'; isDone(url: string): boolean }
  // 127.0.0.1 1회성 리스너 (RFC 8252). 사용자의 기본 브라우저가 흐름을 처리한다.
  | { kind: 'loopback'; port: number }
  // 사용자가 브라우저에서 받은 code 를 앱에 붙여 넣는다.
  | { kind: 'manual' }

export interface OAuthStart {
  url: string
  redirect: OAuthRedirect
  // code → token. verifier 는 코어가 넘겨준다 — 선언이 따로 보관하지 않는다.
  exchange(code: string, verifier: string): Promise<TokenValue>
}

export interface TokenValue {
  token: string
  expiresAt?: number
  refreshToken?: string
  principalId?: string
}

// ── 브라우저 세션 (ADFS/WIA) ──────────────────────────────────────────────────
//
// 같은 `sessionGroup` 을 지정한 provider 들은 **같은 cookie jar 를 직접 공유**한다(복사 아님).
// SSO 쿠키가 각 서비스의 redirect 에서 재사용되고, 서비스별 쿠키도 같은 jar 에 저장되지만
// domain 규칙에 따라 교차 전송되지 않는다.
export interface BrowserSessionConfig {
  sessionGroup: string
  loginUrl: string
  // 이 접두사에 도달하면 로그인 완료로 본다.
  doneUrlPrefix: string
  // 완료 판정을 **한 번 더** 실제 요청으로 확인하는 endpoint. 리다이렉트 루프를 걸러낸다.
  authenticationProbeUrl: string
  // 로그인 창이 오갈 수 있는 origin 전수. 서브도메인 자동 허용 없음.
  allowedOrigins: readonly string[]
  // 선언되면 세션 성립 후 그 쿠키로 사내 API 를 불러 **토큰까지** 받는다(사용자 결정 "둘 다").
  // 없으면 grant 는 세션에서 끝난다. 실값은 배포가 채운다(0181 OQ2).
  exchange?: SessionTokenExchange
}

export interface SessionTokenExchange {
  // origin 기준 상대 경로. 절대 URL 을 쓰지 않는 이유는 `Provider.origin` 밖으로 나가지
  // 못하게 하기 위함이다(정책 판정과 같은 규칙).
  path: string
  // 응답 JSON 에서 토큰을 꺼낼 점 경로. 예: `access_token` · `data.token`.
  valuePath: string
  // 만료(epoch ms 또는 초). 없으면 만료를 모른다 — 401 로만 강등된다.
  expiresAtPath?: string
}

// ── AuthSpec — 요구된 4종 + ADFS ──────────────────────────────────────────────
export type AuthSpec =
  | ({ kind: 'api-key' } & CredentialSpecBase)
  | ({ kind: 'password' } & CredentialSpecBase)
  | ({ kind: 'pat' } & CredentialSpecBase)
  | {
      kind: 'oauth'
      label: string
      present: Presentation
      authorize(ctx: AuthCtx): Promise<OAuthStart>
    }
  | { kind: 'browser-session'; label: string; config: BrowserSessionConfig }

// ── Grant — 인증의 결과물 ─────────────────────────────────────────────────────
//
// `providerId → Grant` **단일 맵**이다. 구 구조의 `bindingId`·`parentBindingId`·cascade·
// fingerprint 는 없다. secret 값은 여기 없고 **vault 키만** 있다.
interface GrantBase {
  authKind: ProviderAuthKind
  principalId?: string
  createdAt: number
  // 만료 시각. 토큰이 실제로 만료를 선언한 경우와, **401 관측으로 강등된 경우**가 같은 필드를
  // 쓴다 — UI 와 게이트가 "지금 못 쓴다" 를 한 가지 방식으로 읽게 하기 위함이다.
  expiresAt?: number
}

export type Grant =
  | ({ kind: 'secret'; vaultKey: string } & GrantBase)
  | ({ kind: 'token'; vaultKey: string; refreshKey?: string } & GrantBase)
  | ({ kind: 'session'; sessionGroup: string } & GrantBase)

// ── Provider — 배포가 채우는 유일한 선언 ──────────────────────────────────────
export interface Provider {
  // 케밥 소문자. **vault 네임스페이스이자 `${BINDING:<id>}` 참조 대상**이므로 한 번 정하면
  // 유지한다 — 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다.
  id: string
  label: string
  kind: ProviderKind
  // 이 provider 가 나갈 수 있는 origin. **경로 없음** (등록 시 검사).
  origin: string
  // 선언 순서 = GUI 선택지 순서. 길이 1이면 GUI 는 선택 단계를 건너뛴다.
  auth: readonly AuthSpec[]
  // kind:'service' — 인증된 연결이 LLM 에 노출하는 런타임 도구.
  tools?: (api: ProviderApi) => RuntimeToolServer
  // kind:'llm' — `sources/settings/<adapter>/<provider>/` 디렉토리 키와의 조인 좌표.
  // `envKey` 는 자격증명을 실을 subprocess 환경변수 이름이다.
  llm?: { adapter: string; provider: string; envKey: string }
}

// ── 소비 표면 ─────────────────────────────────────────────────────────────────
export interface ProviderRequest {
  // `Provider.origin` 기준 상대 경로. 절대 URL 은 거부된다.
  path: string
  method?: string
  headers?: Record<string, string>
  body?: string
}

export interface ProviderResponse {
  ok: boolean
  status: number
  headers: Record<string, string>
  body: string
}

// 앱 안의 다른 모듈이 인증을 쓰는 **단일 포트**. 소비 슬라이스는 `Pick<ProviderApi, …>` 로
// 좁혀 받는다 — 0180 이 지운 `contracts/internal-api.test.ts` 가드는 되살리지 않는다
// (포트가 하나뿐이라 재선언 유인이 없다).
export interface ProviderApi {
  request(providerId: string, req: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse>
  // LLM/MCP 주입용 물질화. 미인증이면 **null** — 빈 문자열 치환 금지(조용한 미인증 진행 방지).
  materialize(
    providerId: string
  ): { env?: Record<string, string>; headers?: Record<string, string> } | null
  // MCP `${BINDING:<대상>}` 용 — 동기 계약 유지(resolver 가 동기다).
  token(providerId: string): string | null
}
