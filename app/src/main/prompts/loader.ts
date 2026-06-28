import { POLICY_REGISTRY, type PolicyBlock } from './registry'

const POLICY_SOURCES: Record<string, string> = {}

export function assemblePolicies(
  registry: readonly Pick<PolicyBlock, 'id' | 'file'>[],
  sources: Record<string, string>
): Map<string, string> {
  const loaded = new Map<string, string>()
  for (const block of registry) {
    const raw = sources[block.id]
    if (raw === undefined) {
      throw new Error(
        `[prompts] 정책 본문 누락: registry id "${block.id}"(${block.file}) 의 본문이 sources 에 없다`
      )
    }
    loaded.set(block.id, raw.trim())
  }
  for (const id of Object.keys(sources)) {
    if (!registry.some((b) => b.id === id)) {
      throw new Error(`[prompts] 미등재 정책 본문: sources "${id}" 가 registry 에 없다`)
    }
  }
  return loaded
}

export function loadPolicies(): Map<string, string> {
  return assemblePolicies(POLICY_REGISTRY, POLICY_SOURCES)
}
