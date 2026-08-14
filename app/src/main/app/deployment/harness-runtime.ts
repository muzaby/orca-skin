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
// ── 채우는 예 (config API 방식) ──────────────────────────────────────────────
//
// ```ts
// export const CLAUDE_CORP_KEY = providerKeyOf('claude', 'corp')
//
// export function createRuntimeConfigAugmenters(deps: {
//   corpAuth: BoundAuth
// }): RuntimeConfigAugmenters {
//   return {
//     [CLAUDE_CORP_KEY]: {
//       async resolve(_input, signal) {
//         if (deps.corpAuth.snapshot().status !== 'valid') {
//           throw new Error('corp model provider authentication required')
//         }
//         // 여기 실리는 OAuth/session 은 **config API 접근 권한**이다 — LLM token 이 아니다.
//         const response = await deps.corpAuth.request({ path: '/api/llm/config' }, signal)
//         if (!response.ok) throw new Error(`llm config request failed: ${response.status}`)
//         // parse 와 매핑은 이 배포 모듈이 소유한다. AuthRuntime 은 body 형상을 모른다.
//         const config = parseCorpLlmConfig(response.body)
//         return {
//           runtimeEnv: {
//             ANTHROPIC_AUTH_TOKEN: config.llmToken,
//             ANTHROPIC_BASE_URL: config.url,
//             ANTHROPIC_DEFAULT_OPUS_MODEL: config.models.opus,
//             ANTHROPIC_DEFAULT_SONNET_MODEL: config.models.sonnet,
//             ANTHROPIC_DEFAULT_HAIKU_MODEL: config.models.haiku
//           },
//           validUntil: config.expiresAt
//         }
//       }
//     }
//   }
// }
// ```
//
// `parseCorpLlmConfig` 는 token·URL·배포가 요구하는 모델 식별자를 **모두** 검증한다. 필수 값이
// 없거나 빈 문자열이면 **부분 env 를 cache 하거나 기존 값과 섞지 말고 resolve 를 실패시킨다** —
// 반쯤 채워진 환경으로 spawn 하면 증상이 원인에서 멀어진다.
//
// ── 채우는 예 (direct credential 방식) ───────────────────────────────────────
//
// ```ts
// export function createDirectCredentialAugmenter(
//   readSecret: () => string | null,
//   expiresAt?: () => number | undefined
// ): RuntimeConfigAugmenter {
//   return {
//     async resolve() {
//       const token = readSecret()
//       // 미인증은 빈 문자열이 아니라 실패다 — 조용한 미인증 진행 금지.
//       if (token === null) throw new Error('model provider credential is not available')
//       return {
//         runtimeEnv: { ANTHROPIC_AUTH_TOKEN: token },
//         ...(expiresAt?.() !== undefined ? { validUntil: expiresAt()! } : {})
//       }
//     }
//   }
// }
// ```
//
// Bootstrap 은 `AuthSecretReader` 전체가 아니라 `() => secretReader.read(CORP_LLM_AUTH.id)` 라는
// **AuthId 를 닫은 closure** 만 넘긴다.

import type { RuntimeConfigAugmenters } from '../../features/harnesses/runtime-config'

// 기본 배포는 동적 보강이 없다 — 모든 key 가 기존 settings 만으로 동작한다.
export function createRuntimeConfigAugmenters(): RuntimeConfigAugmenters {
  return {}
}

// 하나의 Auth 가 여러 Harness key 를 보강하면 Bootstrap 의 구독에서 **그 고정 key 들만**
// 명시적으로 invalidate 한다. 자동 발견하려고 AuthId → feature contribution registry 를
// 만들지 않는다(0188 §성능 계약).
export const AUTH_INVALIDATED_HARNESS_KEYS: Readonly<Record<string, readonly string[]>> = {}
