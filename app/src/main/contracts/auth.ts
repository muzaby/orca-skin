// Auth 계약 (0181 → 0188 재정의) — **인증만** 을 표현하는 유일한 선언이다.
//
// ── 0188 이 여기서 지운 것 ────────────────────────────────────────────────────
// 구 `Provider` 는 `kind:'gate'|'llm'|'service'` · `llm:{adapter,provider,envKey}` · `tools()` 를
// 함께 들고 있었다. 그래서 **인증 코어가 소비자의 제품 분류와 subprocess 환경변수 형상, 런타임
// 도구 기여까지** 알아야 했다. 셋 다 제거했다:
//
//   kind   → Gate membership 은 `app/deployment/gate-auth.ts` 가 객체 참조로 갖는다.
//   llm    → Harness 실행 구성은 `features/harnesses/runtime-config.ts` + 배포 augmenter 소관.
//   tools  → Plugin 이 자기 도구를 만들고 컴포지션 루트가 등록/회수한다.
//
// Auth 는 **자신이 무엇에 쓰이는지 모른다.** 아는 것은 "어떻게 인증하고, 인증된 요청을 어떻게
// 안전하게 내보내는가" 뿐이다.
//
// ── 왜 축이 하나인가 (0181 승계) ──────────────────────────────────────────────
// 구 구조는 프로토콜 enum 이 1급 축이라 `AuthMechanism × AuthTargetKind × CredentialPresentation`
// 이 곱해졌고, 방식이 **별도 레지스트리에 있고 대상이 id 로 참조**해서 참조 무결성 검증까지
// 딸려왔다. 여기서는 `AuthMethod` 가 선언 **안에 인라인**이라 참조가 없다. 런타임 검사는
// 둘뿐이다 — 중복 `id`, `origin` 형태(`features/auth/registry.ts`).
//
// 레이어: contracts → contracts·adapters·infra·shared. 타입 전용이라 런타임 의존이 없다.

// wire 호환 타입만 shared 에서 가져온다 (0188 D-030) — 별도 UI migration 전까지 renderer 가
// 읽는 어휘이므로 여기서 다시 정의하지 않는다.
import type {
  ProviderAuthKind,
  ProviderAuthSpecInfo,
  ProviderFieldInfo,
  ProviderGrantStatus,
  ProviderStepInfo
} from '../../shared/ipc'

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
  authId: AuthId
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
  // refresh token 자체의 만료(epoch ms). **없으면 "모른다" 지 "만료 없음" 이 아니다** (0194
  // D-009) — 그 경우 만료 시 일단 refresh 를 시도하고, 실패하면 재로그인으로 넘어간다. 값이
  // 있고 지났으면 왕복 없이 바로 재로그인한다.
  refreshExpiresAt?: number
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
  // 선언되면 로그인 final URL 이 돌려준 **인가 코드**를 그 세션으로 토큰과 교환한다(0195).
  // 없으면 grant 는 세션에서 끝난다 — 코드를 주지 않는 SP 가 여기다. 실값은 배포가 채운다.
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

// 로그인 final URL 이 돌려준 **인가 코드**를 어디서 꺼내 어떤 이름으로 실을지 (0195 → 0196).
//
// 이름을 코어가 고정하지 않는 이유는 요구 ② 다 — "sp가 final url에서 code 쿼리 반환 (code 이름이
// 아닐 수 있음)". 그 문장은 **코드를 final URL 의 쿼리에서 추출한다**는 뜻이지(0196 D-008) 교환
// 요청의 형상을 지시한 것이 아니다. 요청은 `POST` + `application/json` 하나로 고정이라(D-009)
// 이 선언이 정하는 것은 이름 셋뿐이다 — 어디서 꺼내(`urlParam`) 무슨 이름으로(`bodyField`)
// 무엇과 함께(`extraFields`).
//
// **철자는 0197 D-1 에서 바뀌었다** — 옛 이름은 `param`·`name`·`params` 였다. 단수 `param` 과
// 복수 `params` 가 서로의 복수형이 아니라 완전히 다른 것(URL 파라미터 이름 vs 본문 필드 맵)을
// 가리켰고, `name` 은 목적어가 없었다. 의미·기본값·선택성은 그대로다.
export interface SessionCodeExchange {
  // final URL 에서 코드를 꺼낼 **쿼리 파라미터 이름**. **미지정이면 `'code'`** 다. 쿼리와
  // 프래그먼트를 모두 본다(`response_mode=fragment` 로 돌려주는 배포가 있다).
  urlParam?: string
  // 교환 요청 **본문**에서 코드를 부를 필드 이름. 미지정이면 **유효 `urlParam`**
  // (= `urlParam ?? 'code'`)을 쓴다 — 받은 이름과 보내는 이름이 다른 SP 만 여기를 적는다.
  bodyField?: string
  // 코드와 **함께** 본문에 실어 보낼 고정 필드(`grant_type`·`client_id`·`redirect_uri` 등).
  // 같은 이름이 겹치면 **실제 인가 코드가 이긴다**. 비밀은 여기 적지 않는다 — 이 파일은 배포
  // 소스이지 vault 가 아니다.
  extraFields?: Readonly<Record<string, string>>
}

// 인가 코드를 토큰으로 바꾸는 요청 선언.
//
// **요청은 `POST` + `application/json` 본문 하나로 고정이다** (0196 D-009) — 근거는 "post로 밖에
// 교환이 안됨" 이다. 그래서 이 선언에 전송 형상을 고르는 자리가 없다: 배포가 결정할 것이 없는
// 선택지는 두지 않고, 갈래가 하나면 인가 코드가 URL 에 실릴 경로도 없다. form 본문이 필요한 SP
// 가 나오면 `SessionCodeExchange` 에 `in?: 'json'|'form'` 을 **선택** 필드로 넓힌다 — 그러면
// 기존 선언은 한 글자도 고치지 않아도 유효하다(D-010).
export interface SessionTokenExchange {
  // origin 기준 상대 경로. 절대 URL 을 쓰지 않는 이유는 `Provider.origin` 밖으로 나가지
  // 못하게 하기 위함이다(정책 판정과 같은 규칙).
  path: string
  // **필수** (0195 D-006). 코드를 돌려주지 않는 SP 는 `exchange` 자체를 선언하지 않는다 —
  // 그러면 grant 가 세션에서 끝난다. 쿠키만으로 토큰을 받던 0181 경로는 제거됐다: 토큰의
  // 출처는 교환 응답 JSON 하나뿐이다.
  code: SessionCodeExchange
  // **필수** (0195 D-001). 받은 토큰을 요청에 싣는 방법 — `kind` 에서 추론하지 않는다는 이
  // 파일의 규칙(위 `Presentation` 주석)을 browser-session 도 따른다. 빠지면 교환이 만든 token
  // grant 를 아무 데도 실을 수 없어 모든 API 가 `grant_not_valid` 로 죽는다.
  present: Presentation
  // 응답 JSON 에서 **access token** 을 꺼낼 점 경로. 예: `access_token` · `data.token`.
  // 옛 이름은 `valuePath` 였다(0197 D-2) — 형제 셋(`refreshTokenPath`·`expiresAtPath`·
  // `principalPath`)이 대상을 이름에 담는데 이것만 "value" 였고, 같은 파일 `SessionLookup`
  // 의 `valuePath`(principal 을 가리킨다)와 한 철자가 두 대상을 갖고 있었다.
  accessTokenPath: string
  // 응답 JSON 에서 refresh token 을 꺼낼 점 경로. **미지정이면 저장하지 않는다.** 값을 저장해도
  // 그것으로 갱신하지는 않는다(0195 D-003) — browser-session 의 만료는 재로그인으로 회복한다.
  refreshTokenPath?: string
  // 만료(epoch ms 또는 초). 없으면 만료를 모른다 — 401 로만 강등된다.
  expiresAtPath?: string
  // 같은 응답에 계정 식별자가 실려 오면 그 점 경로. 있으면 `whoami` 를 **부르지 않는다**
  // (추가 왕복 0) — 교환 응답이 이미 신원을 말했는데 한 번 더 묻지 않는다.
  principalPath?: string
}

// ── AuthMethod — 요구된 4종 + ADFS ───────────────────────────────────────────
//
// 구 이름은 `AuthSpec` 이었다(0181). `AuthDefinition.methods` 의 원소라는 것이 이름에서 바로
// 읽히도록 0188 에서 바꿨다 — 형상은 그대로다.
export type AuthMethod =
  | ({ kind: 'api-key' } & CredentialSpecBase)
  | ({ kind: 'password' } & CredentialSpecBase)
  | ({ kind: 'pat' } & CredentialSpecBase)
  | {
      kind: 'oauth'
      label: string
      present: Presentation
      authorize(ctx: AuthCtx): Promise<OAuthStart>
      // RFC 6749 §6 refresh_token grant (0194). **선언하지 않으면 만료 시 재로그인만 남는다** —
      // 조용히 성공시키지 않고 `unsupported` 로 접는다.
      //
      // `AuthCtx` 를 받지 않는 이유: PKCE·state 는 인가 요청의 것이고 refresh 흐름에는 없다.
      // 필요한 입력은 refresh token 하나이며, endpoint·client_id 는 선언의 클로저가 갖는다.
      //
      // **새 `refreshToken` 을 돌려주지 않아도 된다** (D-014). 서버가 회전하지 않으면 access
      // token 만 담아 돌려주면 되고, 그 경우 앱이 **보내던 refresh token 을 그대로 유지**한다.
      // 회전하는 서버는 새 값을 담고, 그러면 옛 값은 커밋과 함께 폐기된다. `refreshExpiresAt`
      // 은 회전 없이도 갱신할 수 있다 — 담아 보내면 그 값이 보관된 만료를 대체한다.
      refresh?(refreshToken: string): Promise<TokenValue>
    }
  | { kind: 'browser-session'; label: string; config: BrowserSessionConfig }

// GUI·로그가 쓰는 방식 식별자. wire 호환 타입을 그대로 승계한다(0188 D-005).
export type AuthMethodKind = ProviderAuthKind

// 안정된 인증 대상 식별자. **vault 네임스페이스이자 `${BINDING:<id>}` 참조 대상**이므로 한 번
// 정하면 유지한다 — 바뀌면 저장된 grant 를 못 읽고 사용자가 적은 MCP 설정이 깨진다.
export type AuthId = string

// ── Grant — 인증의 결과물 ─────────────────────────────────────────────────────
//
// `authId → Grant` **단일 맵**이다. 구 구조의 `bindingId`·`parentBindingId`·cascade·
// fingerprint 는 없다. secret 값은 여기 없고 **vault 키만** 있다.
interface GrantBase {
  authKind: AuthMethodKind
  principalId?: string
  createdAt: number
  // 만료 시각. 토큰이 실제로 만료를 선언한 경우와, **요청 실패 관측으로 강등된 경우**(401/403,
  // 세션 grant 의 origin 미복귀)가 같은 필드를
  // 쓴다 — UI 와 게이트가 "지금 못 쓴다" 를 한 가지 방식으로 읽게 하기 위함이다.
  expiresAt?: number
}

export type Grant =
  | ({ kind: 'secret'; vaultKey: string } & GrantBase)
  | ({
      kind: 'token'
      vaultKey: string
      refreshKey?: string
      refreshExpiresAt?: number
    } & GrantBase)
  | ({ kind: 'session'; sessionGroup: string } & GrantBase)

// `Grant` 의 갈래를 **여기서 한 번** 이름 붙인다 (0197 A-1).
//
// 이 별칭들은 `compact<T>` 의 타입 인자다 — 필드를 빠뜨리면 컴파일이 깨지게 하는 그 기계의
// 입력이다(`shared/obj.ts`). 소비자가 각자 `Extract` 를 다시 쓰면 갈래를 하나 더할 때 낡은
// 사본이 조용히 남고, 그 사본을 쓰는 조립부만 강제에서 빠진다. 0197 이전에는 세 파일이 각자
// 갖고 있었다(`authenticated-request.ts` · `login.ts` · `store-parse.ts`).
export type SecretGrant = Extract<Grant, { kind: 'secret' }>
export type TokenGrant = Extract<Grant, { kind: 'token' }>
export type SessionGrant = Extract<Grant, { kind: 'session' }>
// 세션이 아닌 갈래 전부 — vault 에 값을 두고 요청에 실어 나르는 것들이다.
export type ValueGrant = Exclude<Grant, { kind: 'session' }>

// ── 인증 확인(probe) ──────────────────────────────────────────────────────────
//
// **인증 판정은 이 선언 하나로 통일된다.** 방식마다 판정을 따로 두던 구조(browser-session 은
// `authenticationProbeUrl`+`SessionRunner.verify`, 값형은 아예 없음)를 접었다 — 값형이 확인
// 없이 "연결됨" 이 되던 것과, 같은 판정이 로그인·부팅 두 곳에 다르게 구현돼 있던 것이 같은
// 뿌리였다.
//
// 실행은 인증된 요청 한 줄이다. grant 를 **먼저 커밋한 뒤** 부르므로 세션이면 cookie jar 로,
// 값형이면 `present` 로 실려 나가는 것을 전송 계층이 이미 갈라 준다.
export interface AuthProbe {
  // `AuthDefinition.origin` 기준 상대 경로. 절대 URL 은 거부된다(`whoami`·`exchange` 와 같은 규칙).
  path: string
  method?: string
}

// ── AuthDefinition — 배포가 채우는 유일한 인증 선언 ───────────────────────────
//
// **소비 슬롯이 없다** (0188): `kind`·`tools`·`llm`·`usage`·`envKey` 를 두지 않는다. 이 선언을
// 읽고 "이 Auth 가 무엇에 쓰이는가" 를 알 수 없는 것이 정상이다 — 그 지식은 `app/deployment/`
// 의 배선이 갖는다.
export interface AuthDefinition {
  // 케밥 소문자. 등록 시 형태를 검사한다(`features/auth/registry.ts`).
  id: AuthId
  label: string
  // 이 Auth 가 나갈 수 있는 origin. **경로 없음** (등록 시 검사).
  origin: string
  // 선언 순서 = GUI 선택지 순서. 길이 1이면 GUI 는 선택 단계를 건너뛴다.
  methods: readonly AuthMethod[]
  // 인증이 성립했는지 한 번 물어보는 endpoint. **선언하면 통과해야만 연결이 성립한다** —
  // 로그인 직후에도, 부팅 복원에서도. 미선언이면 확인 없이 통과한다(값이 있으면 valid).
  //
  // **gate 로 쓰는 Auth 는 이것이 필수다.** 다만 그 강제는 여기가 아니라 소비 측이 한다 —
  // `app/deployment/gate-auth.ts` 가 `AuthDefinition & { probe: AuthProbe }` 로 compile-time
  // 제한하고, 부팅 composition 이 런타임에서도 fail-closed 한다(0188 D-007). Auth 코어는
  // 자신이 gate 에 쓰이는지 모른다.
  probe?: AuthProbe
}

// gate 로 쓸 수 있는 Auth 정의. **확인 없이 통과하는 게이트는 곧 우회다.**
export type GateAuthDefinition = AuthDefinition & { probe: AuthProbe }

// ── 인증된 전송 ───────────────────────────────────────────────────────────────
export interface AuthenticatedRequest {
  // `AuthDefinition.origin` 기준 상대 경로. 절대 URL 은 거부된다(origin 우회 방지). 컨텍스트
  // 경로(`/confluence`)가 있는 배포는 호출자가 여기에 prefix 를 붙인다.
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

export interface AuthenticatedResponse {
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

// ── 상태와 변화 ───────────────────────────────────────────────────────────────
export interface AuthSnapshot {
  authId: AuthId
  status: AuthStatus
  // Grant 가 **존재하는 것**과 실제 probe 를 **통과한 것**을 구분한다. gate 는 둘 다 요구한다.
  //
  // grant 는 디스크에서 복원되는 *기록*이고, 특히 `kind:'session'` grant 는 vault 도 만료도
  // 없이 기록만으로 `valid` 가 된다. 그래서 한 번 로그인에 성공한 id 가 영구히 통과 상태가
  // 됐다(사용자 보고: "성공한 id 가 bypass 와 같은 현상"). 이 값은 **프로세스 수명 한정**이라
  // 디스크에 남기는 순간 그 영구 bypass 가 돌아온다.
  verified: boolean
  // 실행 credential 또는 그 사용 가능성이 **실제로 바뀔 때만** 증가하는 메모리 단조 값이다.
  // 입력 form, OAuth code 대기, resuming, 실패 message 같은 UI step 에서는 증가하지 않는다.
  credentialRevision: number
  activeMethod?: AuthMethodKind
  principalId?: string
  expiresAt?: number
}

// wire 호환 상태 어휘를 그대로 승계한다(0188 D-005 — renderer 가 이 문자열을 읽는다).
export type AuthStatus = ProviderGrantStatus

export type AuthSnapshotChangeCause =
  'credential-committed' | 'revoked' | 'expired' | 'unauthorized' | 'verified'

// **renderer 갱신 이벤트와 실행 credential invalidation 을 한 boolean 으로 뭉개지 않는다.**
//
// | Auth 변화                                   | GUI push | Gate | Plugin tool sync | Harness invalidate |
// |---|---|---|---|---|
// | 입력 form·OAuth 대기·resuming·오류 message  | O | O | X | X |
// | 기존 Grant probe 성공으로 `verified` 만 변경 | O | O | X | X |
// | credential commit·revoke·expiry·401/403     | O | O | O | 영향 key 만 O |
export type AuthChange =
  | {
      kind: 'snapshot'
      authId: AuthId
      cause: AuthSnapshotChangeCause
      snapshot: AuthSnapshot
      // Harness runtime config 는 이것이 true 인 change 만 무효화한다.
      credentialChanged: boolean
    }
  | { kind: 'step'; authId: AuthId; step: AuthStep | null }

// 진행 중 인증 단계. wire 타입을 그대로 승계한다.
export type AuthStep = ProviderStepInfo

// renderer 와 app view mapper 가 읽는 **secret 없는 설명**이다.
export interface AuthDescriptor {
  authId: AuthId
  label: string
  origin: string
  methods: readonly AuthMethodDescriptor[]
}

export type AuthMethodDescriptor = ProviderAuthSpecInfo

// ── 소비 표면 ─────────────────────────────────────────────────────────────────
//
// 소비 feature 는 `AuthRuntime` 전체가 아니라 **자기 Auth 에 묶인 좁은 포트**를 받는다. 구
// 시그니처 `request(authId, …)` 는 소비자가 자기 id 를 문자열로 **다시 적게** 만들었고, 그
// 문자열이 선언과 어긋나면 도구는 모델에 보이는데 호출할 때마다 `unknown_provider` 로 죽었다
// (컴파일러도 등록 검사도 못 잡는다). 여기서는 적을 자리가 없다.
export interface BoundAuth {
  readonly authId: AuthId
  snapshot(): AuthSnapshot
  request(request: AuthenticatedRequest, signal?: AbortSignal): Promise<AuthenticatedResponse>
}

// 자기 Auth 를 고르기만 하는 소비자의 표면 (0190).
//
// 위 원칙("소비는 `AuthRuntime` 전체가 아니라 좁은 포트")을 **타입으로** 세운다. 0188 의 배포
// factory 4종은 `AuthRuntime` 전체를 받아 `login`·`continue`·`reauth`·`revoke`·`resume`·
// `subscribe` 까지 쥐고 있었다 — 실제로 필요한 것은 `bind` 하나다. 제안서는 `BoundAuth` 만
// 넘기라고 했지만 배포는 자기 AuthId 로 **직접 bind** 해야 하므로(레시피가 그렇게 쓴다) 그
// 형태로는 성립하지 않는다. 능력 하나를 이름 붙여 좁히는 것이 두 요구를 모두 만족한다.
//
// **인증 lifecycle 을 도는 것은 배포의 일이 아니다** — 그것은 IPC 핸들러(`app/handlers/
// providers.ts`)와 부팅 복원(`app/auth-resume.ts`)이 소유한다.
export type AuthBinder = Pick<AuthRuntime, 'bind'>

export interface AuthRuntime {
  bind(authId: AuthId): BoundAuth
  tryBind(authId: AuthId): BoundAuth | null
  describe(authId: AuthId): AuthDescriptor
  currentStep(): AuthStep | null
  subscribe(listener: (change: AuthChange) => void): () => void

  // Auth 하나의 복원된 Grant 를 probe 한다. **순서·병렬성·step 노출 여부는 app composition 이
  // 정한다** — Auth 코어는 gate 가 먼저인지 모른다.
  //
  // `emitVerifiedChange:false` 는 부팅 batch 의 **성공 알림만** 지연한다. expiry·401/403 강등은
  // 항상 즉시 emit 한다(만료된 연결의 도구가 남은 probe 의 타임아웃만큼 화면에 남지 않도록).
  resume(
    authId: AuthId,
    options?: { exposeStep?: boolean; emitVerifiedChange?: boolean }
  ): Promise<void>
  login(authId: AuthId, method?: AuthMethodKind, input?: Record<string, string>): Promise<AuthStep>
  continue(authId: AuthId, input: Record<string, string>): Promise<AuthStep>
  reauth(authId: AuthId, method?: AuthMethodKind): Promise<AuthStep>
  revoke(authId: AuthId): void

  // 만료된 token grant 를 refresh token 으로 갱신한다 (0194). **`login` 과 달리 창을 열지
  // 않는다** — 조용한 요청 하나라, 만료 회복에서 재로그인보다 먼저 시도한다.
  //
  // `AuthStep` 이 아니라 전용 결과를 돌려주는 이유(D-013): 이 결과의 소비자는 부팅 복원
  // (`app/auth-resume.ts`) 하나이고, `ProviderFailureReason` 을 늘리면 renderer·i18n·문서가
  // 따라와야 하는데 화면에 나갈 것이 없다.
  refresh(authId: AuthId): Promise<AuthRefreshResult>
}

// `refresh` 의 3분기. 호출자는 `'refreshed'` 가 아니면 전부 재로그인으로 넘어간다.
//
//   refreshed   — 새 토큰이 probe 를 통과해 커밋됐다.
//   unsupported — 시도할 수 없었다(선언 미구현 · refresh token 없음 · 이미 만료 · token grant 아님).
//   failed      — 시도했으나 실패했다(선언이 던짐 · 새 토큰이 probe 를 통과하지 못함).
export type AuthRefreshResult = 'refreshed' | 'unsupported' | 'failed'

// ── trusted-main 전용 raw credential 포트 ─────────────────────────────────────
//
// **`createAuthRuntime` 의 app composition 결과에만 둔다.** `RouterContext`·renderer IPC·일반
// feature dependency 에는 전달하지 않는다 — 일반 소비는 `BoundAuth.request()` 로 충분하고,
// 그것으로 충분한 소비자까지 secret 표면을 넓히지 않는다.
//
// 쓰이는 곳은 둘뿐이다:
//   MCP `${BINDING:<id>}`  — resolver 가 동기라 read 도 동기 계약이다.
//   Harness direct-credential augmenter — 사용자가 입력한 API key 를 subprocess env 에 직접
//                                          놓아야 하는 배포. **config API 방식에는 주지 않는다.**
//
// Bootstrap 은 전체 reader 가 아니라 **AuthId 를 닫은 closure** 만 전달한다.
export interface AuthSecretReader {
  read(authId: AuthId): string | null
}
