// ═══════════════════════════════════════════════════════════════════════════
// SSO 확장점 계약 (0130) — 폐쇄망(사내) 배포용 커스텀 로그인 체인.
//
// 이 파일은 `contracts/usage-report.ts` 와 함께 외부 에이전트(회사별 구현자)가
// 참조하는 **동결(생성 후 불변) 확장점 2파일** 중 하나다.
//
// 불변 정책 (additive-optional-only):
//   - 허용: optional 필드/메서드 *추가* (TS 구조적 타이핑 — 기존 회사 모듈이 계속 컴파일된다).
//   - 금지: 기존 멤버의 제거·개명·required 화·시그니처 파괴 변경.
//   - 파괴적 변경이 필요하면 이 파일을 고치지 말고 `contracts/sso-v2.ts` 를 신설해
//     레지스트리에 병행 필드로 받는다. v1 은 그대로 둔다.
//
// 구현/등록 규약 (정본: features/sso/index.ts + features/sso/modules/AGENTS.md):
//   - 모듈은 회사 포크/브랜치의 **컴파일 타임 코드**다. 런타임 동적 로딩(임의 경로
//     require()/import()) 은 금지 — Electron main 에서 보안·타입검증 양면으로 비권장.
//   - 등록은 `features/sso/modules/index.ts` 배럴 한 줄(명시적 opt-in). 신규 설치의
//     기본 등록은 null(로그인 게이트 없음)이다.
//   - login() 내부의 체인(다단계 사내 서비스 패스스루, OAuth 변형, 사내 토큰, CLI 호출,
//     재시도/페이지네이션)은 전부 모듈 소유다 — 프레임워크는 스텝을 모델링하지 않고
//     SsoContext 를 주고 SsoLoginOutcome 만 소비한다.
// ═══════════════════════════════════════════════════════════════════════════

import type { SsoFieldSpec, SsoIdentity } from '../../shared/ipc'

// 네임스페이스가 강제된 비밀 저장소 뷰(safeStorage 암호화, infra SecretFacade 와 동형).
export interface SsoSecretFacade {
  get(name: string): string | null
  set(name: string, value: string): void
  delete(name: string): void
}

export interface SsoExecResult {
  code: number | null
  stdout: string
  stderr: string
}

// login()/restore() 1회 실행 동안 유효한 컨텍스트. signal 은 프레임워크 소유 타임아웃
// (SsoProviderModule.loginTimeoutMs) — 모듈의 fetch/exec 에 전파하라.
export interface SsoContext {
  fetch: typeof fetch
  signal: AbortSignal
  // LoginView 입력 필드 값 (SsoFieldSpec.name 키). restore() 호출 시에는 항상 {}.
  input: Record<string, string>
  // 모듈 전용 비밀 네임스페이스 (`sso:<moduleKey>:`) — 세션 토큰 캐시 등.
  secret: SsoSecretFacade
  // usage provider 와의 토큰 공유 핸드셰이크 — `provider:<providerKey>:` 네임스페이스.
  // 여기 set 한 비밀은 같은 providerKey 의 정적 usage provider 가 ctx.secret /
  // `${SECRET:name}` 으로 읽는다. providerKey 형식은 `<adapter>-<provider>` (예: 'claude-inhouse').
  providerSecrets(providerKey: string): SsoSecretFacade
  // 획득 토큰을 LLM 백엔드에 전달 — provider settings.json 의 env 블록에 **리터럴로 병합
  // 기록**한다 (sources/settings/<adapter>/<provider>/settings.json). 주의: 디스크 평문이다
  // (사용자 수기 API 키와 동일 노출 등급). 원치 않으면 providerSecrets 경로만 사용하라.
  setProviderEnv(adapter: string, provider: string, env: Record<string, string>): void
  // CLI 체인 지원 — child_process.execFile 래퍼(shell 미경유, 인자 배열 그대로).
  exec(
    file: string,
    args: readonly string[],
    opts?: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; stdin?: string }
  ): Promise<SsoExecResult>
  // 브라우저형 플로우(OAuth 변형 등) — 앱 세션과 쿠키가 격리된 창을 열고 isDone(url) 이
  // 참이 되는 내비게이션에서 닫은 뒤 최종 URL + 해당 세션 쿠키를 반환한다.
  openAuthWindow(opts: {
    url: string
    isDone(url: string): boolean
    width?: number
    height?: number
    timeoutMs?: number
  }): Promise<{
    finalUrl: string
    cookies: Array<{ name: string; value: string; domain?: string }>
  }>
  env: Record<string, string>
  // 모듈 전용 비-비밀 KV (JSON 직렬화 가능 값).
  store: { get(key: string): unknown; set(key: string, value: unknown): void }
  logger: (message: string, meta?: Record<string, unknown>) => void
  clock: () => number
}

export type SsoLoginOutcome =
  | { ok: true; identity?: SsoIdentity }
  // message 는 LoginView 에 그대로 표기된다(회사 언어 재량). 생략 시 앱 카탈로그 폴백.
  | { ok: false; message?: string }

export interface SsoProviderModule {
  // 모듈 식별자(비밀 네임스페이스 `sso:<key>:` 에 쓰임). 케밥 소문자 권장.
  key: string
  // 로그인 화면 입력 필드 선언. 생략/빈 배열이면 버튼만 렌더된다.
  fields?: readonly SsoFieldSpec[]
  // login()/restore() 타임아웃(ms). 기본 300_000 — 대화형 체인(브라우저 창 등)은 길다.
  loginTimeoutMs?: number
  // 로그인 시도. throw 는 프레임워크가 { ok:false } 로 격리한다.
  login(ctx: SsoContext): Promise<SsoLoginOutcome>
  // 부팅 시 무입력 silent 복원(저장 토큰 검증 등). null 반환 = 복원 불가(로그인 화면으로).
  // 미구현이면 매 앱 실행마다 로그인 화면부터 시작한다(현행 동작).
  restore?(ctx: SsoContext): Promise<SsoLoginOutcome | null>
}
