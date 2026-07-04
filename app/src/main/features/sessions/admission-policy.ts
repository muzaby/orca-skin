// Turn admission 정책(0056). 메커니즘(AdmissionController)과 정책 분리. 진행 중 턴에 대한
// 사용자 입력의 실경로는 chat:steer + PendingMessageQueue(features/chat)가 담당하므로(0059
// 설계전환 → 0066), admission 은 중복 chat:send race 의 hard reject 만 판정한다.

export type AdmissionTarget<W = unknown> =
  | { kind: 'existing-session'; sessionId: string }
  | { kind: 'new-session-slot'; owner: W }

export interface AdmissionContext<W = unknown> {
  target: AdmissionTarget<W>
  hasInflight: boolean
}

export type AdmissionDecision = { kind: 'accept' } | { kind: 'reject'; reason: 'duplicate-turn' }

export interface AdmissionPolicy<W = unknown> {
  decide(ctx: AdmissionContext<W>): AdmissionDecision
}

export class RejectDuplicatePolicy<W = unknown> implements AdmissionPolicy<W> {
  decide(ctx: AdmissionContext<W>): AdmissionDecision {
    if (ctx.hasInflight) return { kind: 'reject', reason: 'duplicate-turn' }
    return { kind: 'accept' }
  }
}
