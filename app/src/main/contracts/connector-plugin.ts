// ═══════════════════════════════════════════════════════════════════════════
// Connector 계약 v1 (0157) — "인증이 필요한 내장 도구" 의 실행 계약.
//
// connector 는 **인증 provider 를 직접 구현하지 않고 raw credential 을 읽지 않는다.**
// 연결 설정 시 `acceptedAuthProviders` 중 하나로 binding 을 만들고, 실행 시에는
// `authenticatedFetch(bindingId, …)` 만 호출한다 — broker 가 policy 확인 후 header·cookie 를
// 주입한다 (AUTH-PLAT-009).
//
// ── 레이어 주의 ──────────────────────────────────────────────────────────────
//   `features/connectors` 는 `features/auth-platform` 을 **직접 import 할 수 없다**
//   (feature 수직 슬라이스 교차 금지, eslint-plugin-boundaries 강제).
//   그래서 `AuthenticatedFetch` 를 여기 **구조적 포트**로 선언하고, 컴포지션 루트
//   (`app/bootstrap.ts`)가 broker 구현을 주입한다 — `src/main/AGENTS.md` §해소책 2+3.
// ═══════════════════════════════════════════════════════════════════════════

import type { AuthMechanism, CredentialPresentation } from '../../shared/ipc'

// ── authenticated fetch 포트 ─────────────────────────────────────────────────

export interface AuthenticatedFetchRequest {
  bindingId: string
  connectorId: string
  method: string
  // connector manifest 의 baseUrl 기준 상대 경로. 절대 URL 은 거부된다(origin 우회 방지).
  // 컨텍스트 경로(`/confluence`)가 있는 배포는 connector 가 여기에 prefix 를 붙인다 —
  // baseUrl 은 경로 없는 origin 이어야 하므로(manifest `OriginSchema`) 경로는 이쪽 몫이다.
  path: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: string
  // 응답 본문 형태. **미지정 = `'text'`** (기존 동작 보존). 첨부·이미지처럼 바이트가 필요한
  // 요청만 `'binary'` 를 쓴다 — 0160 이전에는 `res.text()` 뿐이라 바이너리 수신 경로가
  // 아예 없었다.
  responseType?: 'text' | 'binary'
  // 수신 상한. 미지정이면 상한 없음(기존 동작). 선언된 `content-length` 와 실제 누적
  // 바이트를 **둘 다** 검사한다 — 서버가 길이를 속이거나 안 보낼 수 있다.
  maxBytes?: number
}

export interface AuthenticatedFetchResponse {
  status: number
  headers: Record<string, string>
  // `responseType:'binary'` 응답에서는 빈 문자열이다. 텍스트 소비자가 그대로 남는다.
  body: string
  // `responseType:'binary'` 일 때만 채워진다.
  bodyBytes?: Uint8Array
}

// broker 가 구현하고 connector runtime 이 소비하는 유일한 인증 표면.
// connector 가 `Authorization`·API-key header·`Cookie` 를 직접 덮어쓰는 요청은 거부된다.
export type AuthenticatedFetch = (
  req: AuthenticatedFetchRequest,
  signal?: AbortSignal
) => Promise<AuthenticatedFetchResponse>

// ── connector 계약 ───────────────────────────────────────────────────────────

export interface ConnectorDescriptor {
  id: string
  pluginId: string
  label: string
  // 이 connector 가 받아들이는 auth provider id 목록. 하나의 connector 가 ADFS browser
  // session 과 PAT 를 함께 허용할 수 있다.
  acceptedAuthProviders: readonly string[]
  // 요청이 나갈 수 있는 origin. 미선언 origin·redirect 는 broker 가 거부한다.
  baseUrl: string
  // credential 을 요청 어디에 어떤 형식으로 넣을지. **kind 에서 추론하지 않는다** —
  // 같은 PAT 를 서비스별로 Bearer / Basic password / PRIVATE-TOKEN 으로 다르게 붙인다.
  presentation: CredentialPresentation
  // 인증 방식(binding 의 mechanism)마다 표현이 다를 때. 하나의 connector 가 PAT(Bearer)와
  // ID/비밀번호(Basic)를 함께 받으면 표현이 하나로 고정될 수 없다(0160). 선언에 없는
  // mechanism 은 위 `presentation` 으로 되돌아가므로 기존 패키지는 무변경으로 동작한다.
  presentations?: Partial<Record<AuthMechanism, CredentialPresentation>>
}

export interface ConnectorContext {
  readonly connectionId: string
  readonly bindingId: string
  readonly authenticatedFetch: AuthenticatedFetch
  readonly signal: AbortSignal
  readonly logger: (message: string, meta?: Record<string, unknown>) => void
}

export type ConnectorHealth = 'ready' | 'unauthenticated' | 'unreachable' | 'error'

export interface ConnectorStatus {
  health: ConnectorHealth
  message?: string
}

export interface ConnectorRequest {
  operation: string
  params?: Record<string, unknown>
}

export type ConnectorResult =
  { ok: true; data: unknown } | { ok: false; message: string; health?: ConnectorHealth }

export interface ConnectorRuntimeV1 {
  readonly descriptor: ConnectorDescriptor

  start(ctx: ConnectorContext): Promise<ConnectorStatus>
  invoke(ctx: ConnectorContext, request: ConnectorRequest): Promise<ConnectorResult>
  stop(ctx: ConnectorContext): Promise<void>
}
