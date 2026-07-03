import type { ManagedRuntime } from '../../contracts/ports'

// IdleRuntimeEntry 는 RuntimePool 이 만든 snapshot 의 한 행이다. policy 는 Map/Timer 를 모르고,
// victim sessionId 키만 돌려준다(0055: mechanism ↔ policy 분리).
export interface IdleRuntimeEntry<RT = ManagedRuntime> {
  sessionId: string
  runtime: RT
}

export interface EvictionPolicy<RT = ManagedRuntime> {
  // capacity 는 "eviction 후 idle pool 이 가져야 할 최대 idle 개수"다. active runtime 수는
  // Supervisor 가 total cap → idle target capacity 로 변환하므로 policy 는 알지 못한다.
  selectVictims(entries: readonly IdleRuntimeEntry<RT>[], capacity: number): string[]
}

export class LruEvictionPolicy<RT = ManagedRuntime> implements EvictionPolicy<RT> {
  selectVictims(entries: readonly IdleRuntimeEntry<RT>[], capacity: number): string[] {
    const target = Math.max(0, Math.floor(capacity))
    const victimCount = Math.max(0, entries.length - target)
    return entries.slice(0, victimCount).map((entry) => entry.sessionId)
  }
}
