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
  // 로그인 창이 오갈 수 있는 origin 전수. 서브도메인 자동 허용 없음.
  allowedOrigins: readonly string[]
  // 선언되면 세션 성립 후 그 쿠키로 사내 API 를 불러 **토큰까지** 받는다(사용자 결정 "둘 다").
  // 없으면 grant 는 세션에서 끝난다. 실값은 배포가 채운다(0181 OQ2).
  exchange?: SessionTokenExchange
  // 선언되면 세션 성립 후 **누가 로그인했는지**를 한 번 더 물어 `Grant.principalId` 로 싣는다
  // (0182). 사이드바가 그 값을 표시한다.
  //
  // **`Provider.probe` 를 재사용하지 않는 이유**: probe 는 판정(2xx + 최종 origin 복귀)만 보고
  // 본문이 **마지막 홉의 것**이라 신원 문서라는 보장이 없다. 그래서 같은 cookie jar 로
  // `send()` 를 한 번 더 부른다.
  //
  // **조회 실패는 로그인 실패가 아니다** — principal 은 표시용이라, 못 읽었다고 인증을 되돌리면
  // "이름을 못 읽어서 로그인이 안 되는" 상태가 된다. 실패하면 principal 만 빈 채로 진행한다.
  whoami?: SessionLookup
}

// 세션 쿠키로 사내 API 를 한 번 부르고 JSON 에서 값 하나를 꺼내는 선언. `exchange` 와 같은
// 형상이라 배포가 규칙을 두 번 배우지 않는다.
export interface SessionLookup {
  // `Provider.origin` 기준 **상대 경로**. 절대 URL 을 쓰지 않는 이유는 두 가지다 — origin 밖으로
  // 나가지 못하게 하고, 로그인 후 갱신을 `ProviderApi.request` 로 그대로 재사용할 수 있게
  // 하기 위함이다(그쪽은 절대 경로를 `absolute_path` 로 거부한다).
  path: string
  // 응답 JSON 에서 값을 꺼낼 점 경로. 예: `mail` · `user.email`.
  valuePath: string
}

export interface SessionTokenExchange {
  // origin 기준 상대 경로. 절대 URL 을 쓰지 않는 이유는 `Provider.origin` 밖으로 나가지
  // 못하게 하기 위함이다(정책 판정과 같은 규칙).
  path: string
  // 응답 JSON 에서 토큰을 꺼낼 점 경로. 예: `access_token` · `data.token`.
  valuePath: string
  // 만료(epoch ms 또는 초). 없으면 만료를 모른다 — 401 로만 강등된다.
  expiresAtPath?: string
  // 같은 응답에 계정 식별자가 실려 오면 그 점 경로. 있으면 `whoami` 를 **부르지 않는다**
  // (추가 왕복 0) — 교환 응답이 이미 신원을 말했는데 한 번 더 묻지 않는다.
  principalPath?: string
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

// ── 인증 확인(probe) ──────────────────────────────────────────────────────────
//
// **인증 판정은 이 선언 하나로 통일된다.** 방식마다 판정을 따로 두던 구조(browser-session 은
// `authenticationProbeUrl`+`SessionRunner.verify`, 값형은 아예 없음)를 접었다 — 값형이 확인
// 없이 "연결됨" 이 되던 것과, 같은 판정이 로그인·부팅 두 곳에 다르게 구현돼 있던 것이 같은
// 뿌리였다.
//
// 실행은 `ProviderApi.request` 한 줄이다. grant 를 **먼저 커밋한 뒤** 부르므로 세션이면
// cookie jar 로, 값형이면 `present` 로 실려 나가는 것을 `transport()` 가 이미 갈라 준다.
export interface ProviderProbe {
  // `Provider.origin` 기준 상대 경로. 절대 URL 은 거부된다(`whoami`·`exchange` 와 같은 규칙).
  path: string
  method?: string
}

// ── 런타임 도구 컨텍스트 ──────────────────────────────────────────────────────
//
// `tools` 는 `ProviderApi` 전체가 아니라 **자기 provider 에 묶인 좁은 포트**를 받는다. 구
// 시그니처 `(api: ProviderApi) => …` 는 선언이 자기 id 를 `api.request('<id>', …)` 로 **다시
// 적게** 만들었고, 그 문자열이 `Provider.id` 와 어긋나면 도구는 모델에 보이는데 호출할 때마다
// `unknown_provider` 로 죽었다(컴파일러도 등록 검사도 못 잡는다). 여기서는 적을 자리가 없다.
export interface ProviderToolContext {
  providerId: string
  label: string
  origin: string
  request(req: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse>
}

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
  // 인증이 성립했는지 한 번 물어보는 endpoint. **선언하면 통과해야만 연결이 성립한다** —
  // 로그인 직후에도, 부팅 복원에서도. 미선언이면 확인 없이 통과한다(값이 있으면 valid).
  // `kind:'gate'` 는 필수다(확인 없이 통과하는 게이트 = 우회, `auth/registry.ts` 가 거부).
  probe?: ProviderProbe
  // kind:'service' — 인증된 연결이 LLM 에 노출하는 런타임 도구.
  tools?: (ctx: ProviderToolContext) => RuntimeToolServer
  // kind:'llm' — `sources/settings/<adapter>/<provider>/` 디렉토리 키와의 조인 좌표.
  // `envKey` 는 자격증명을 실을 subprocess 환경변수 이름이다.
  llm?: { adapter: string; provider: string; envKey: string }
}

// **사용량 선언 슬롯은 두지 않는다 (0183 r2).** 구 `features/providers/static/modules/` 도,
// 그것을 선언으로 옮긴 `Provider.usage` 도 제거했다 — SP 의 사용량 endpoint 가 필요해지면
// 그 기능을 쓰는 feature 가 `ProviderApi.request` 로 직접 부르고, 주기 실행이 필요하면
// 컴포지션 루트가 `Scheduler` 에 action 을 등록한다(절차: 가이드 §5-b).

// ── 소비 표면 ─────────────────────────────────────────────────────────────────
export interface ProviderRequest {
  // `Provider.origin` 기준 상대 경로. 절대 URL 은 거부된다(origin 우회 방지). 컨텍스트 경로
  // (`/confluence`)가 있는 배포는 호출자가 여기에 prefix 를 붙인다.
  path: string
  method?: string
  headers?: Record<string, string>
  // 경로와 분리해 받는다 — 호출자가 직접 이으면 인코딩 규칙이 호출부마다 갈린다.
  query?: Record<string, string>
  body?: string
  // 응답 본문 형태. **미지정 = `'text'`**. 첨부·이미지처럼 바이트가 필요한 요청만 `'binary'`.
  responseType?: 'text' | 'binary'
  // 수신 상한. 미지정이면 상한 없음. 선언된 `content-length` 와 실제 누적 바이트를 **둘 다**
  // 검사한다 — 서버가 길이를 속이거나 안 보낼 수 있다.
  maxBytes?: number
}

export interface ProviderResponse {
  ok: boolean
  status: number
  // 리다이렉트를 다 따라간 끝의 URL. 요청 URL 과 같을 수 있다.
  //
  // **probe 판정이 이것을 본다** (0174 실기 교정): SSO 배포는 인증에 성공해도 probe 가 302 로
  // 로그인 URL 을 가리키고 그 체인이 자동 완주해 보호 리소스로 돌아온다. 반대로 미인증이면
  // IdP 로그인 폼에 머문 채 **200** 을 준다. status 만 보면 후자를 인증됨으로 오독한다.
  finalUrl: string
  headers: Record<string, string>
  // `responseType:'binary'` 응답에서는 빈 문자열이다.
  body: string
  // `responseType:'binary'` 일 때만 채워진다.
  bodyBytes?: Uint8Array
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
