// 선언 → 사용량 spec (0183).
//
// 구 구조는 `features/providers/static/modules/` 가 축이었고, 조인이 둘이었다:
//   ① 모듈 `sourceId` → provider id      (어느 SP 를 부를까)
//   ② 모듈 `adapter`/`provider` → 디렉토리 (누구의 한도인가)
// 둘 중 하나만 어긋나도 `refreshAll` 의 filter 가 **말없이** 걸러내 사용량이 멈췄다.
//
// 이제 ①은 없다 — **`usage` 를 선언한 provider 가 곧 호출 대상**이다. ②는 `llm` 좌표에서
// 파생되므로 대개 적을 일이 없고, 적더라도 한 곳뿐이다.
//
// 레이어: features/providers → contracts 만. 순수 함수라 vitest 대상.

import type { Provider, UsageSpec } from '../../contracts/provider'

export interface UsageSpecEntry {
  // 리포트가 붙을 대상.
  providerKey: string
  // 호출 대상 = 선언한 provider.
  providerId: string
  spec: UsageSpec
}

export type UsageSpecRejection = { providerId: string; reason: 'no_provider_key' }

export interface UsageSpecResult {
  entries: UsageSpecEntry[]
  rejected: UsageSpecRejection[]
}

// `providerKey` 는 명시값 우선, 없으면 `llm` 좌표에서 파생한다(`${adapter}-${provider}` —
// `ProviderSettingsService` 가 디렉토리에서 만드는 것과 **같은 형식**).
export function usageProviderKey(provider: Provider): string | null {
  const explicit = provider.usage?.providerKey?.trim()
  if (explicit) return explicit
  if (provider.llm) return `${provider.llm.adapter}-${provider.llm.provider}`
  return null
}

// **거부를 조용히 버리지 않는다.** 구 구조의 침묵이 이 작업의 출발점이라, 대상을 못 정한 선언은
// 호출부가 로그로 남길 수 있게 함께 돌려준다.
export function usageSpecs(providers: readonly Provider[]): UsageSpecResult {
  const entries: UsageSpecEntry[] = []
  const rejected: UsageSpecRejection[] = []
  for (const provider of providers) {
    const spec = provider.usage
    if (!spec) continue
    const providerKey = usageProviderKey(provider)
    if (providerKey === null) {
      rejected.push({ providerId: provider.id, reason: 'no_provider_key' })
      continue
    }
    entries.push({ providerKey, providerId: provider.id, spec })
  }
  return { entries, rejected }
}
