// 정책 본문 로더 — policies/*.md 를 vite `?raw` 로 번들에 인라인하고(마이그레이션의 `.sql?raw`
// 동형, db/migrate.ts 참조), registry 와의 정합을 검증한다. `?raw` 는 vitest 에서도 동일하게
// 동작한다 (db/queries.test.ts 가 `.sql?raw` 사용).
//
// 본문은 `.trim()` 해 적재한다 — 구 PY_AGENT_RULES 가 `.trim()` 된 상수였으므로 바이트 동일 보존.

import pythonRuntime from './policies/python-runtime.md?raw'
import { POLICY_REGISTRY, type PolicyBlock } from './registry'

// id → 본문(`?raw`). 새 정책 추가 절차: (1) policies/*.md 생성 (2) registry 등재 (3) 여기 import.
// 셋이 어긋나면 assemblePolicies 가 throw 한다 (드리프트 방지).
const POLICY_SOURCES: Record<string, string> = {
  'python-runtime': pythonRuntime
}

// 순수 코어 — registry 와 본문 맵의 정합을 검증하고 id→trim(본문) Map 을 만든다. 합성 입력으로
// 누락/잉여 경로를 단위 테스트하기 위해 분리했다.
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
  // 잉여: 본문은 있으나 registry 에 미등재된 id (조립에서 영원히 누락되는 죽은 본문 차단).
  for (const id of Object.keys(sources)) {
    if (!registry.some((b) => b.id === id)) {
      throw new Error(`[prompts] 미등재 정책 본문: sources "${id}" 가 registry 에 없다`)
    }
  }
  return loaded
}

// 실제 적재 — 번들 import 본문을 레지스트리로 검증해 반환한다. startup 1회 호출(router).
export function loadPolicies(): Map<string, string> {
  return assemblePolicies(POLICY_REGISTRY, POLICY_SOURCES)
}
