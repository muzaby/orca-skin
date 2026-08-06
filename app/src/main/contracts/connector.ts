// ═══════════════════════════════════════════════════════════════════════════
// Connector 계약 (0157 → 0178 축소) — "인증이 필요한 내장 도구" 의 실행 계약.
//
// connector 는 **인증을 직접 구현하지 않고 raw credential 을 읽지 않는다.** 실행 시에는
// `ctx.request({ target, … })` 만 부른다 — 대상 이름 하나로 인증 레코드를 찾아 header·cookie 를
// 붙이는 일은 `InternalApi` 구현이 한다.
//
// ── 레이어 주의 ──────────────────────────────────────────────────────────────
//   `features/connectors` 는 `features/auth-platform` 을 **직접 import 할 수 없다**
//   (feature 수직 슬라이스 교차 금지). 그래서 호출 표면은 `contracts/internal-api.ts` 의
//   구조적 포트이고, 컴포지션 루트(`app/bootstrap.ts`)가 구현을 주입한다.
// ═══════════════════════════════════════════════════════════════════════════

import type { AuthMechanism, CredentialPresentation } from '../../shared/ipc'
import type { InternalApiRequest, InternalApiResponse } from './internal-api'

export interface ConnectorDescriptor {
  // 대상 이름 = `InternalApiRequest.target`. 도구 이름·승인 키·다운로드 경로가 여기서 파생된다.
  id: string
  label: string
  // 이 대상에 쓸 수 있는 인증 방식 id 목록. 하나의 대상이 브라우저 세션과 PAT 를 함께 허용한다.
  acceptedMethods: readonly string[]
  // 요청이 나갈 수 있는 origin. 미선언 origin·redirect 는 거부된다.
  baseUrl: string
  // credential 을 요청 어디에 어떤 형식으로 넣을지. **mechanism 에서 추론하지 않는다** —
  // 같은 PAT 를 서비스별로 Bearer / Basic password / PRIVATE-TOKEN 으로 다르게 붙인다.
  presentation: CredentialPresentation
  // 인증 방식마다 표현이 다를 때. PAT(Bearer)와 ID/비밀번호(Basic)를 함께 받으면 표현이 하나로
  // 고정될 수 없다. 선언에 없는 mechanism 은 위 `presentation` 으로 되돌아간다.
  presentations?: Partial<Record<AuthMechanism, CredentialPresentation>>
}

export interface ConnectorContext {
  readonly connectionId: string
  // 인증된 요청. `target` 은 이 connector 의 `descriptor.id` 다.
  readonly request: (req: InternalApiRequest, signal?: AbortSignal) => Promise<InternalApiResponse>
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

export interface ConnectorRuntime {
  readonly descriptor: ConnectorDescriptor

  start(ctx: ConnectorContext): Promise<ConnectorStatus>
  invoke(ctx: ConnectorContext, request: ConnectorRequest): Promise<ConnectorResult>
  stop(ctx: ConnectorContext): Promise<void>
}
