// LLM 조인 (0181) — `sources/settings/<adapter>/<provider>/` 디렉토리 열거와 `Provider` 선언을
// 잇는다.
//
// ── 디렉토리 = 열거 SSOT 는 깨지 않는다 ─────────────────────────────────────
// 모델 목록·기본 provider 선택·`crossesProviderBoundary` respawn 판정이 전부 디렉토리 열거에
// 걸려 있다(0014/0118). 이 모듈은 **조인만** 한다 — 선언이 없는 provider 는 지금과 똑같이 돈다.
//
// ── 주입 지점을 실측으로 정정했다 (plan R3·R4) ──────────────────────────────
// 0180 plan 은 "`${...}` 확장 경로에 주입" 이라고 적었지만 **LLM settings 는 `${VAR}` 를 확장하지
// 않는다**(`adapters/claude-settings.ts` — 0028 이 폐지). 실제 seam 은 `buildTurnEnv` 가 만드는
// **subprocess `Options.env`** 다. settings.json 은 여전히 verbatim 이고, 0028 이 없앤 것
// (설정 파일에 토큰을 써 넣는 것)은 되살리지 않는다.

import type { Provider, ProviderApi } from '../contracts/auth'
import { providerKeyOf } from '../infra/config/provider-key'

// `sources/settings` 트리의 합성 키(`<adapter>-<provider>`) → 선언. 조인 키가 한 곳에만 있어야
// 규칙이 갈리지 않는다.
export function llmProviderKey(provider: Provider): string | null {
  return provider.llm ? providerKeyOf(provider.llm.adapter, provider.llm.provider) : null
}

export function findLlmProvider(
  declarations: readonly Provider[],
  providerKey: string | null
): Provider | undefined {
  if (!providerKey) return undefined
  return declarations.find((provider) => llmProviderKey(provider) === providerKey)
}

// 선택된 provider 의 자격증명을 subprocess env 레이어로 물질화한다.
//
// **미인증이면 빈 객체다** — 그 키를 아예 넣지 않는다. 빈 문자열로 치환하면 "인증됐지만 값이
// 빈" 요청이 나가고, 서버는 401 대신 이상한 오류를 준다(진단이 어려워진다).
export function llmEnvFor(
  api: Pick<ProviderApi, 'materialize'>,
  declarations: readonly Provider[],
  providerKey: string | null
): Record<string, string> {
  const provider = findLlmProvider(declarations, providerKey)
  if (!provider) return {}
  return api.materialize(provider.id)?.env ?? {}
}
