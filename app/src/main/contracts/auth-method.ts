// ═══════════════════════════════════════════════════════════════════════════
// 인증 방식 진입점 (0178) — 구 `contracts/auth-plugin.ts` 를 대체한다.
//
// 사내 서비스를 붙이는 쪽이 채우는 **유일한 인터페이스**다. dd 의 open/read/write 처럼
// 함수가 셋뿐이고, 그 셋으로 앱 로그인(application)과 서비스 연결(connector)을 함께 다룬다.
//
//   authenticate  인증한다. 입력이 더 필요하면 알리고, 호출자가 채워 다시 부르면 완료된다.
//   status        지금 유효한가.
//   revoke        이 인증이 만든 자원을 지운다.
//
// ── 승계된 금지 정책 ─────────────────────────────────────────────────────────
//   **런타임 동적 로딩(임의 경로 require()/import()) 은 금지한다.** Electron main 에서
//   임의 코드 실행은 filesystem·cookie·Vault 전권을 주는 것과 같다. 인증 방식은 **빌드 타임
//   등록**이고, "재빌드 없이 서비스 추가" 는 **MCP** 가 담당한다.
//
// ── 형태 강제는 타입 시스템이 한다 ───────────────────────────────────────────
//   등록 배열의 `satisfies readonly AuthMethod[]` 가 컴파일 타임에 형태를 확정한다. manifest·
//   `apiVersion` ABI·선언↔구현 대조는 0178 에서 걷어냈다 — 전부 컴파일 타임에 이미 참인
//   명제를 런타임에 재확인하던 것이다.
//
// ── 핵심 불변식 ──────────────────────────────────────────────────────────────
//   1. 미지원 동작은 **결과 유니온에 없으면 그만**이다. 구 `not_supported` 반환 규약이
//      사라진 이유 — 지원하지 않는 것을 표현하려고 값을 만들 필요가 없다.
//   2. 성공 결과에 raw token·PAT·cookie·Electron `Session` 을 담을 수 없다. `AuthArtifactRef`
//      는 `handleId` 문자열만 갖는다.
//   3. context 에는 Vault 전체·cookie API 를 노출하지 않는다. 방식은 자기 네임스페이스와
//      선언한 origin 안에서만 움직인다 (최소 권한).
// ═══════════════════════════════════════════════════════════════════════════

import type { PreparedRequest, SendOptions, SendResult } from '../infra/auth/authenticated-fetch'
import type {
  AuthArtifactRef,
  AuthFailureReason,
  AuthFieldSpec,
  AuthMechanism,
  AuthPrincipal,
  AuthTarget,
  AuthTargetKind,
  CredentialMeta
} from '../../shared/ipc'

// ── vault ────────────────────────────────────────────────────────────────────

// 인증 방식이 자기 credential 을 봉인·조회하는 네임스페이스 뷰. prefix 는 플랫폼이 강제하므로
// 다른 방식의 비밀에 닿을 수 없다. `get` 을 허용하는 이유는 자기가 봉인한 값을 status probe 에서
// 다시 쓰기 때문이다 — 막는 것은 renderer·Agent·Skill 로의 유출이지 생산자 자신의 재사용이 아니다.
export interface CredentialVaultView {
  get(name: string): string | null
  set(name: string, value: string, meta: CredentialMeta): void
  delete(name: string): void
  describe(name: string): CredentialMeta | null
}

// ── browser session ──────────────────────────────────────────────────────────

// ADFS/WIA 류 브라우저 세션. **partition 문자열도 cookie 도 반환하지 않는다.**
export interface BrowserSessionCapability {
  // session group 의 Electron Session 을 확보하고 handle 을 돌려준다. 같은 group 이면
  // 같은 cookie jar 를 **직접 공유**한다(복사 아님).
  acquire(sessionGroup: string): Promise<string>
  // 통제된 로그인 창. isDone(url) 이 참이 되는 내비게이션에서 닫고 최종 URL 만 준다.
  openLoginWindow(
    handleId: string,
    opts: { url: string; isDone(url: string): boolean; width?: number; height?: number }
  ): Promise<{ finalUrl: string }>
  // 인증 상태 probe — 같은 세션으로 요청하고 응답 본문이 아니라 판정만 돌려준다.
  probe(handleId: string, url: string): Promise<BrowserProbeResult>
  // 같은 세션(cookie jar·통합 인증)으로 실제 요청을 보내고 **응답을 그대로** 돌려준다.
  // 0178 이전에는 이 표면이 없어서 SSO 로그인으로 사내 REST 를 부르면 본문이 빈 문자열이었다 —
  // probe 판정만 되돌아왔기 때문이다. 리다이렉트는 따라가지 않는다(홉마다 정책을 봐야 한다).
  send(
    handleId: string,
    req: PreparedRequest,
    options?: SendOptions,
    signal?: AbortSignal
  ): Promise<SendResult>
  // 로그아웃 정리. scope='origin' 은 해당 origin 쿠키만, 'group' 은 session group 전체.
  clear(handleId: string, opts: { scope: 'origin' | 'group'; origin?: string }): Promise<void>
}

export interface BrowserProbeResult {
  ok: boolean
  status: number
  finalUrl: string
}

// ── context ──────────────────────────────────────────────────────────────────

// 선언한 origin 으로만 나가는 fetch. 미선언 origin 요청은 거부되고, redirect 는 자동으로
// 따라가지 않는다(`redirect:'manual'`) — 자격증명이 실린 요청이 allowlist 밖으로 새지 않게.
//
// **이것이 교환형 인증의 진입점이다** (0178, 사용자 결정 2026-08-06). `sso → code → token` 처럼
// 로그인 결과를 한 번 더 교환해야 하는 흐름은 `authenticate` 안에서 HTTP 를 부를 수 있어야
// 성립한다 — 그 구현은 폐쇄망 배포가 소유하고, 코어는 부를 수단만 제공한다.
//
// (0178 중간에 "소비자 0" 을 이유로 한 번 걷어냈다가 되살렸다. 저장소 안에 호출자가 없던 것은
//  사실이지만, 이 표면의 소비자는 애초에 **폐쇄망 포크**다 — 확장점의 사용처를 저장소 내부에서만
//  세면 확장점은 늘 죽은 코드로 보인다.)
export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>

// 세 함수 1회 실행 동안 유효한 컨텍스트. `signal` 은 플랫폼 소유 타임아웃 — fetch 에 전파하라.
export interface AuthContext {
  readonly target: AuthTarget
  // 이번 재진입에서 사용자가 채운 입력(`AuthFieldSpec.name` 키). 첫 호출·status·revoke 에서는 {}.
  readonly input: Record<string, string>
  readonly signal: AbortSignal
  readonly vault: CredentialVaultView
  readonly browserSessions: BrowserSessionCapability
  // 선언한 origin 으로만 나간다. 쿠키를 실어야 하면 `browserSessions.send` 를 쓴다.
  readonly fetch: AuthFetch
  readonly logger: (message: string, meta?: Record<string, unknown>) => void
  readonly clock: () => number
}

// ── 결과 타입 ────────────────────────────────────────────────────────────────

// 인증이 만든 레코드의 초안. `id`·`createdAt` 은 플랫폼이 부여한다.
export interface AuthRecordDraft {
  mechanism: AuthMechanism
  artifact: AuthArtifactRef
  principal?: AuthPrincipal
  parentBindingId?: string
  expiresAt?: number
}

// `authenticate` 의 결과 4분기. 구 `AuthStep` 의 `device_code`·`not_supported` 는 생산자가
// 0이라 사라졌고, `browser` 는 창 흐름이 `authenticate` 안에서 끝나므로 별도 단계가 아니다.
export type AuthOutcome =
  | { kind: 'input-required'; fields: readonly AuthFieldSpec[]; message?: string }
  | { kind: 'authenticated'; record: AuthRecordDraft }
  | { kind: 'failed'; reason: AuthFailureReason; message?: string }

// `status` 의 결과. `revoked` 가 없는 것은 의도다 — 취소는 레코드 삭제로 표현한다.
export type AuthRecordStatus = 'valid' | 'expired' | 'unknown'

// ── descriptor & method ──────────────────────────────────────────────────────

export interface AuthMethodDescriptor {
  // 인증 방식 식별자(비밀 네임스페이스에 쓰인다). 케밥 소문자.
  id: string
  // 이 방식을 묶는 논리 그룹. 앱 로그인 체인의 단위이기도 하다.
  groupId: string
  label: string
  targets: readonly AuthTargetKind[]
  mechanisms: readonly AuthMechanism[]
  // 이 방식이 접근할 수 있는 origin allowlist. 미선언 origin 요청·redirect 는 거부된다.
  allowedOrigins: readonly string[]
  // 브라우저 세션을 쓰는 방식의 cookie jar 논리 이름.
  sessionGroup?: string
  // `authenticate` 타임아웃(ms). 기본 300_000 — 대화형(브라우저 창 등)은 길다.
  loginTimeoutMs?: number
}

// 모든 인증 방식이 구현하는 단일 계약. optional 메서드는 없다.
export interface AuthMethod {
  readonly descriptor: AuthMethodDescriptor

  // 재진입한다. 입력이 더 필요하면 `input-required` 로 알리고, 호출자가 그 필드를 채워 다시
  // 부르면 `authenticated` 로 끝난다. throw 는 플랫폼이 `failed` 로 격리한다.
  authenticate(ctx: AuthContext): Promise<AuthOutcome>
  // 이 레코드가 지금도 유효한가. 판정 결과는 호출자가 레코드 상태에 반영한다.
  status(ctx: AuthContext, record: AuthRecordRef): Promise<AuthRecordStatus>
  // 이 레코드가 소유한 자원 정리. 공유 session group 전체를 지우지 않는다. throw = 실패.
  revoke(ctx: AuthContext, record: AuthRecordRef): Promise<void>
}

// 인증 방식에게 넘기는 레코드 참조 — 플랫폼이 소유한 레코드의 읽기 전용 투영.
export interface AuthRecordRef {
  id: string
  target: AuthTarget
  mechanism: AuthMechanism
  artifact: AuthArtifactRef
  expiresAt?: number
}
