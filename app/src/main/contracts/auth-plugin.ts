// ═══════════════════════════════════════════════════════════════════════════
// 인증 provider 계약 v1 (0157) — 구 `contracts/sso.ts` 를 대체한다.
//
// 하나의 lifecycle 로 **앱 로그인(application)과 서비스 연결(connector)** 을 함께 다룬다.
// 두 경우의 차이는 `AuthTarget.kind` 뿐이고 별도 인증 인터페이스를 만들지 않는다.
//
// ── 승계된 금지 정책 (구 sso.ts 에서 이어받음, 근거 유효) ────────────────────
//   **런타임 동적 로딩(임의 경로 require()/import()) 은 금지한다.** Electron main 에서
//   임의 코드 실행은 filesystem·cookie·Vault 전권을 주는 것과 같고 타입 검증도 성립하지
//   않는다. auth provider 와 connector 는 **빌드 타임 플러그인**(컴파일 타임 등록)이다.
//   "재빌드 없이 서비스 추가" 요구는 **MCP** 가 담당한다 — 확장 모델 정본은
//   `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` §확장 모델.
//
// ── ABI 정책 (additive-optional-only) ────────────────────────────────────────
//   - 허용: optional 필드/메서드 *추가*.
//   - 금지: 기존 멤버의 제거·개명·required 화·시그니처 파괴 변경.
//   - 파괴적 변경이 필요하면 이 파일을 고치지 말고 `contracts/auth-plugin-v2.ts` 를 신설해
//     registry 에 병행 apiVersion 으로 받는다. v1 은 그대로 둔다 (AUTH-PLAT-014).
//
// ── 핵심 불변식 ──────────────────────────────────────────────────────────────
//   1. 4메서드(begin/continue/status/logout)는 **전부 required**. 미지원 동작은
//      메서드 부재가 아니라 `not_supported` 표준 결과로 반환한다 (AUTH-PLAT-002).
//      core 는 메서드 존재 여부로 provider 종류를 추론하지 않는다.
//      (`refresh` 는 0178 에서 제거했다 — provider 3/3 이 `not_supported` 만 돌려주어
//       규약만 남은 표면이었다.)
//   2. 성공 결과에는 raw token·PAT·cookie·Electron `Session` 을 담을 수 없다 — `AuthArtifactRef`
//      는 `handleId` 문자열만 갖는다 (AUTH-PLAT-008).
//   3. context 에는 Vault 전체·cookie API·`process.env` 전체를 노출하지 않는다. provider 는
//      자기 네임스페이스와 선언한 origin 안에서만 움직인다 (최소 권한).
// ═══════════════════════════════════════════════════════════════════════════

import type {
  AuthCapability,
  AuthFailureReason,
  AuthFieldSpec,
  AuthMechanism,
  AuthPrincipal,
  AuthTarget,
  AuthTargetKind,
  AuthArtifactRef,
  AuthBindingStatus,
  CredentialMeta
} from '../../shared/ipc'

// ── vault ────────────────────────────────────────────────────────────────────

// provider 가 자기 credential 을 봉인·조회하는 네임스페이스 뷰. prefix 는 플랫폼이 강제하므로
// 다른 provider 의 비밀에 닿을 수 없다.
//
// `get` 을 허용하는 이유: provider 가 스스로 봉인한 값을 status probe 등에서 다시 쓰기 때문이다.
// AUTH-PLAT-008 이 막는 것은 **renderer·Agent·Skill·connector** 로의 유출이지, 값을 만든
// provider 자신의 재사용이 아니다.
export interface CredentialVaultView {
  get(name: string): string | null
  set(name: string, value: string, meta: CredentialMeta): void
  delete(name: string): void
  // 값 없이 metadata 만 조회 (UI 표기·만료 판정용).
  describe(name: string): CredentialMeta | null
}

// ── browser session ──────────────────────────────────────────────────────────

// ADFS/WIA 류 브라우저 세션 capability. **partition 문자열도 cookie 도 반환하지 않는다** —
// 구 `SsoContext.openAuthWindow` 가 쿠키를 통째로 돌려주던 표면을 의도적으로 없앴다.
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
  // 로그아웃 정리. scope='origin' 은 해당 origin 쿠키만, 'group' 은 session group 전체.
  // connector-only disconnect 가 공유 세션을 통째로 날리지 않게 기본은 'origin'.
  clear(handleId: string, opts: { scope: 'origin' | 'group'; origin?: string }): Promise<void>
}

export interface BrowserProbeResult {
  ok: boolean
  status: number
  finalUrl: string
}

// ── 실행 capability ──────────────────────────────────────────────────────────

// declarator 가 선언한 origin 으로만 나가는 fetch. 미선언 origin·redirect 는 거부된다.
export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>

// ── context ──────────────────────────────────────────────────────────────────

// begin()/continue()/status()/refresh()/logout() 1회 실행 동안 유효한 컨텍스트.
// `signal` 은 플랫폼 소유 타임아웃 — 모듈의 fetch/exec 에 전파하라.
export interface AuthPluginContext {
  readonly target: AuthTarget
  // 현재 step 의 입력 필드 값(AuthFieldSpec.name 키). begin/status/refresh/logout 에서는 {}.
  readonly input: Record<string, string>
  readonly signal: AbortSignal
  readonly vault: CredentialVaultView
  readonly browserSessions: BrowserSessionCapability
  readonly fetch: AuthFetch
  // provider 전용 비-비밀 KV (JSON 직렬화 가능 값). 프로세스 수명 동안만 유지된다.
  readonly store: { get(key: string): unknown; set(key: string, value: unknown): void }
  // 선언한 이름만 읽히는 env 접근자. `process.env` 전체 노출 금지.
  readonly env: (name: string) => string | undefined
  readonly logger: (message: string, meta?: Record<string, unknown>) => void
  readonly clock: () => number
}

// ── 결과 타입 ────────────────────────────────────────────────────────────────

// provider 가 만드는 binding 초안. `id`·`createdAt` 은 플랫폼이 부여한다.
export interface AuthBindingDraft {
  mechanism: AuthMechanism
  artifact: AuthArtifactRef
  principal?: AuthPrincipal
  parentBindingId?: string
  expiresAt?: number
}

// transaction 의 다음 단계. `transactionId` 는 provider 가 아니라 **플랫폼이 부여**하므로
// 여기 없다 (shared `AuthStepInfo` 가 그것을 붙인 renderer 노출형).
export type AuthStep =
  | { kind: 'collect'; fields: readonly AuthFieldSpec[]; message?: string }
  | { kind: 'browser'; message?: string }
  | { kind: 'done'; binding: AuthBindingDraft }
  | { kind: 'failed'; reason: AuthFailureReason; message?: string }
  | { kind: 'not_supported' }

export type AuthStatusResult =
  | { kind: 'status'; status: AuthBindingStatus; principal?: AuthPrincipal; expiresAt?: number }
  | { kind: 'not_supported' }

export type AuthLogoutResult =
  { kind: 'logged_out' } | { kind: 'not_supported' } | { kind: 'failed'; message?: string }

// ── descriptor & provider ────────────────────────────────────────────────────

export interface AuthProviderDescriptor {
  // contribution 식별자(비밀 네임스페이스에 쓰인다). 케밥 소문자 권장.
  id: string
  // 이 contribution 을 제공하는 패키지 id.
  pluginId: string
  label: string
  targets: readonly AuthTargetKind[]
  mechanisms: readonly AuthMechanism[]
  capabilities: readonly AuthCapability[]
  // 이 provider 가 접근할 수 있는 origin allowlist. 미선언 origin 요청·redirect 는 거부된다.
  allowedOrigins: readonly string[]
  // browser_session capability 를 가진 provider 의 cookie jar 논리 이름.
  sessionGroup?: string
  // begin()/continue() 타임아웃(ms). 기본 300_000 — 대화형 체인(브라우저 창 등)은 길다.
  loginTimeoutMs?: number
}

// 모든 인증 provider 가 구현하는 단일 계약. optional 메서드는 없다.
export interface AuthProviderV1 {
  readonly descriptor: AuthProviderDescriptor

  // 인증 시작. 다음 UI step 을 반환한다. throw 는 플랫폼이 failed 로 격리한다.
  begin(ctx: AuthPluginContext): Promise<AuthStep>
  // transaction 진행. 최종 성공은 { kind:'done', binding } 이며 raw secret 을 담지 않는다.
  continue(ctx: AuthPluginContext): Promise<AuthStep>
  // binding 유효성 확인(probe 등). 미지원이면 not_supported.
  status(ctx: AuthPluginContext, binding: AuthBindingRef): Promise<AuthStatusResult>
  // 이 binding 이 소유한 자원 정리. 공유 session group 전체를 지우지 않는다.
  logout(ctx: AuthPluginContext, binding: AuthBindingRef): Promise<AuthLogoutResult>
}

// provider 에게 넘기는 binding 참조 — 플랫폼이 소유한 레코드의 읽기 전용 투영.
export interface AuthBindingRef {
  id: string
  target: AuthTarget
  mechanism: AuthMechanism
  artifact: AuthArtifactRef
  expiresAt?: number
}
