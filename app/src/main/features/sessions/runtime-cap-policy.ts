type RuntimeCapDecision = 'accept' | 'evict-idle'

interface RuntimeCapContext {
  // active + idle 이 cap count 대상(SessionRuntime population)이다. ActiveTurnTracker 의
  // 프로젝트별 turn count 와 섞지 않는다.
  active: number
  idle: number
  total: number
  capacity: number | null
}

export interface RuntimeCapPolicy {
  admit(ctx: RuntimeCapContext): RuntimeCapDecision
}

export class UnlimitedRuntimeCapPolicy implements RuntimeCapPolicy {
  admit(): RuntimeCapDecision {
    return 'accept'
  }
}

// 기본 주입은 무제한이지만, config 도입 전에도 동일 production code path 로 bounded 정책을 검증할
// 수 있게 L1 정책으로 제공한다. reject/queue 는 0056 admission UX 소관이라 여기서 결정하지 않는다.
export class BoundedRuntimeCapPolicy implements RuntimeCapPolicy {
  admit({ idle, total, capacity }: RuntimeCapContext): RuntimeCapDecision {
    if (capacity === null || !Number.isFinite(capacity)) return 'accept'
    if (total <= capacity) return 'accept'
    return idle > 0 ? 'evict-idle' : 'accept'
  }
}
