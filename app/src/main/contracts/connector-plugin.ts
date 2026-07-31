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

import type { CredentialPresentation } from '../../shared/ipc'

// ── authenticated fetch 포트 ─────────────────────────────────────────────────

export interface AuthenticatedFetchRequest {
  bindingId: string
  connectorId: string
  method: string
  // connector manifest 의 baseUrl 기준 상대 경로. 절대 URL 은 거부된다(origin 우회 방지).
  path: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: string
}

export interface AuthenticatedFetchResponse {
  status: number
  headers: Record<string, string>
  body: string
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
  apiVersion: 1
  label: string
  // 이 connector 가 받아들이는 auth provider id 목록. 하나의 connector 가 ADFS browser
  // session 과 PAT 를 함께 허용할 수 있다.
  acceptedAuthProviders: readonly string[]
  // 요청이 나갈 수 있는 origin. 미선언 origin·redirect 는 broker 가 거부한다.
  baseUrl: string
  // credential 을 요청 어디에 어떤 형식으로 넣을지. **kind 에서 추론하지 않는다** —
  // 같은 PAT 를 서비스별로 Bearer / Basic password / PRIVATE-TOKEN 으로 다르게 붙인다.
  presentation: CredentialPresentation
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
