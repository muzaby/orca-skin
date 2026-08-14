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
}

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
