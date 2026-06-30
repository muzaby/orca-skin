// Turn admission 정책(0056). 메커니즘(AdmissionController)과 정책을 분리해 현재 기본
// 동작은 hard reject 로 보존하고, 후속 steer/queue 정책은 같은 인터페이스로 교체한다.

export type AdmissionTarget<W = unknown> =
  | { kind: 'existing-session'; sessionId: string }
  | { kind: 'new-session-slot'; owner: W }

export interface AdmissionContext<W = unknown> {
  target: AdmissionTarget<W>
  hasInflight: boolean
}

export type AdmissionDecision =
  | { kind: 'accept' }
  | { kind: 'reject'; reason: 'duplicate-turn' }
  // 예약 seam(0056 framework-only). 실제 queue/steer enactment 는 후속 handoff 가 L3 에서 채운다.
  | { kind: 'queue' }
  | { kind: 'steer' }

export interface AdmissionPolicy<W = unknown> {
  decide(ctx: AdmissionContext<W>): AdmissionDecision
}

export class RejectDuplicatePolicy<W = unknown> implements AdmissionPolicy<W> {
  decide(ctx: AdmissionContext<W>): AdmissionDecision {
    if (ctx.hasInflight) return { kind: 'reject', reason: 'duplicate-turn' }
    return { kind: 'accept' }
  }
}
