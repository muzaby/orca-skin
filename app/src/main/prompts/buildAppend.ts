// append 조립기 — registry 순서대로 stable + (조건 충족) conditional 블록을 골라 단일 문자열로
// 합친다 (가이드 5.5). **반드시 단일 문자열 반환** — 다중 시스템 프롬프트 블록에 SDK 가
// cache_control 을 잘못 부착해 4블록 초과 시 API 가 400 을 반환하는 버그를 회피하기 위함(가이드 2장).

import { POLICY_REGISTRY, type BuildContext, type PolicyBlock } from './registry'

// loaded = loader.loadPolicies() 결과(id→본문). 조립 결과는 ExtensionBuilder 가 프로젝트 지침과
// 합쳐 systemPromptAppend(=preset append)로 흘린다. registry 인자는 기본 POLICY_REGISTRY 며,
// 조건부 필터 메커니즘을 합성 레지스트리로 단위 테스트하기 위한 seam 으로만 주입한다.
export function buildAppend(
  ctx: BuildContext,
  loaded: Map<string, string>,
  registry: readonly PolicyBlock[] = POLICY_REGISTRY
): string {
  return registry
    .filter((b) => b.tier === 'stable' || (b.when?.(ctx) ?? false))
    .map((b) => {
      const body = loaded.get(b.id)
      if (body === undefined) {
        throw new Error(
          `[prompts] 로드되지 않은 정책 본문: "${b.id}" — loadPolicies 를 먼저 호출했는가`
        )
      }
      return body
    })
    .join('\n\n')
}
