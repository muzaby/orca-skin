// Harness 실행 구성 배선 (0188 — 구 `features/providers/declarations/llm.ts`).
//
// **새 ModelProvider 정의 배열이 아니다** (D-013). 선택 가능한 Harness+ModelProvider 목록과
// Model 목록의 SSOT 는 계속 `sources/settings/<harness>/<modelProvider>/` 디렉터리다. 여기서는
// **이미 존재하는 key 에 필요한 augmenter 만** 붙인다. 매핑에 key 가 없으면 기존 settings 와
// app env 만으로 동작하고 network 는 0이다.
//
// ── 두 방식을 한 factory 가 동시에 받지 않는다 ───────────────────────────────
//
// ```text
// config API 방식
//   BoundAuth.request → OAuth/session 으로 API 접근 → 응답의 실제 LLM token·URL·Model 변수
//
// direct credential 방식
//   닫힌 readSecret() → 사용자가 입력한 API key/token 을 runtimeEnv 에 직접 배치
// ```
//
// 갈라 두는 이유는 **OAuth access token 을 config 응답의 LLM token 으로 오인할 여지를 타입과
// 배선에서 제거**하기 위함이다. config API augmenter 에는 `AuthSecretReader` 를 넘기지 않는다.
//
// ── 채우는 법 ────────────────────────────────────────────────────────────────
// 두 방식의 완전한 구현 예제는 `docs/guides/closed-network-extensions.md` §3-c 다 (0190 —
// 소스와 가이드에 같은 레시피를 두면 갈린다. 실제로 갈렸다). 여기 남기는 것은 예제를 읽기
// 전에 알아야 하는 계약뿐이다:
//
//   · config API augmenter 에는 `AuthSecretReader` 를 넘기지 않는다. 응답을 해석해 얻은 LLM
//     token 과 그 API 를 부르기 위한 OAuth access token 은 **다른 값**이다.
//   · 응답 매핑(`parse…`)은 배포 모듈이 소유한다 — Auth 는 body 형상을 모른다. 필수 값이
//     없으면 **부분 env 를 cache 하거나 기존 값과 섞지 말고 resolve 를 실패시킨다.** 반쯤
//     채워진 환경으로 spawn 하면 증상이 원인에서 멀어진다.
//   · direct credential 은 미인증을 빈 문자열이 아니라 **실패**로 낸다 — 조용한 미인증 진행 금지.
//   · Bootstrap 은 `AuthSecretReader` 전체가 아니라 **AuthId 를 닫은 closure** 만 넘긴다.

import type { AuthBinder, AuthId } from '../../contracts/auth'
import type { RuntimeConfigAugmenters } from '../../features/harnesses/runtime-config'

// ── 두 능력은 **타입으로** 갈라져 있다 (r5 D-048) ─────────────────────────────
//
// r4 까지는 `HarnessRuntimeDeploymentDeps` 하나가 `auth` 와 `secretFor` 를 함께 줬고, "둘을 한
// augmenter 에 주지 마라" 는 경계는 **주석에만** 있었다. 그러면 config API factory 도 raw secret
// 을 읽을 수 있고 direct credential factory 도 API 요청을 낼 수 있다 — 지키라고 적어 둔 규칙을
// 타입이 전혀 막지 않았다. 그래서 deps 를 둘로 쪼개고 Bootstrap 이 각각 좁은 능력만 넘긴다.
//
// 그 경계가 OAuth access token(=API 접근 권한)과 응답의 실제 LLM token 을 가른다.

// config API 방식 — `BoundAuth.request` 로 사내 설정 API 를 부른다. raw secret 은 못 읽는다.
export interface HarnessConfigApiDeps {
  auth: AuthBinder
}

// direct credential 방식 — 사용자가 입력한 API key 를 runtimeEnv 에 직접 놓는다. API 요청 능력이
// 없다.
//
// **selector 가 아니라 이미 닫힌 closure 를 받는다** (r6). r5 는 `secretFor: (authId) => () => …`
// 라는 *고르는 함수* 를 넘겼는데, 그것은 factory 가 **임의 Auth 의 secret 을 고를 수 있다**는
// 뜻이라 제안서의 "특정 AuthId 를 닫은 `() => string | null` 만 전달한다" 를 만족하지 않는다.
// 이제 배포가 `DIRECT_CREDENTIAL_AUTH_IDS` 로 필요한 id 를 **미리 선언**하고, Bootstrap 은 그
// id 들에 대해서만 닫힌 closure 를 만든다. 선언하지 않은 Auth 는 이 map 에 키 자체가 없다.
export interface HarnessDirectCredentialDeps {
  secrets: Readonly<Record<AuthId, () => string | null>>
}

// 배포가 direct credential 방식으로 쓸 AuthId 선언. Bootstrap 은 이 목록만큼만 closure 를 만든다.
export const DIRECT_CREDENTIAL_AUTH_IDS: readonly AuthId[] = []

// 기본 배포는 동적 보강이 없다 — 모든 key 가 기존 settings 만으로 동작한다.
export function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {
  void deps
  return {}
}

export function createDirectCredentialAugmenters(
  deps: HarnessDirectCredentialDeps
): RuntimeConfigAugmenters {
  void deps
  return {}
}

// Bootstrap 이 부르는 합류점. **각 factory 는 자기 능력만 받는다** — 이 함수가 둘을 아는 유일한
// 자리이고, 여기서도 서로의 deps 를 섞어 넘기지 않는다.
//
// **key 가 겹치면 던진다** (r6). r5 는 주석으로 "진단한다" 고 적어 두고 실제로는 spread 로 direct
// 값이 config API 값을 조용히 덮었다 — 같은 Harness key 를 두 방식이 동시에 보강하는 것은 배포
// 실수이고, 조용히 하나를 고르면 어느 쪽이 이겼는지 실행 중에는 알 수 없다. 부팅에서 죽는 편이 낫다.
export function createRuntimeConfigAugmenters(
  deps: HarnessConfigApiDeps & HarnessDirectCredentialDeps
): RuntimeConfigAugmenters {
  return mergeAugmenters(
    createConfigApiAugmenters({ auth: deps.auth }),
    createDirectCredentialAugmenters({ secrets: deps.secrets })
  )
}

// 합류 규칙 자체를 **export 한다** (r7) — 기본 배포는 둘 다 비어 있어 위 함수만으로는 충돌
// 규칙을 실행할 수 없고, 테스트가 규칙을 자기 안에 다시 구현하면 여기 가드를 지워도 통과한다.
export function mergeAugmenters(
  configApi: RuntimeConfigAugmenters,
  direct: RuntimeConfigAugmenters
): RuntimeConfigAugmenters {
  const collisions = Object.keys(direct).filter((key) => key in configApi)
  if (collisions.length > 0) {
    throw new Error(
      `harness runtime config augmenter key collision: ${collisions.join(', ')} — ` +
        'config API 방식과 direct credential 방식이 같은 key 를 보강할 수 없다'
    )
  }
  return { ...configApi, ...direct }
}

// 하나의 Auth 가 여러 Harness key 를 보강하면 Bootstrap 의 구독에서 **그 고정 key 들만**
// 명시적으로 invalidate 한다. 자동 발견하려고 AuthId → feature contribution registry 를
// 만들지 않는다(0188 §성능 계약).
export const AUTH_INVALIDATED_HARNESS_KEYS: Readonly<Record<string, readonly string[]>> = {}
