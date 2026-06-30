// AdmissionController — §A 가로축 입력 admission 의 순수 결정기(0056).
// Supervisor 조회와 renderer forward 는 L3(send.ts) 책임이며, 이 모듈은 이미 계산된 context 를
// 받아 정책을 질의할지 결정만 한다.

import type { AdmissionContext, AdmissionDecision, AdmissionPolicy } from './admission-policy'

export type {
  AdmissionContext,
  AdmissionDecision,
  AdmissionPolicy,
  AdmissionTarget
} from './admission-policy'
export { RejectDuplicatePolicy } from './admission-policy'

export class AdmissionController<W = unknown> {
  constructor(private readonly policy: AdmissionPolicy<W>) {}

  admit(ctx: AdmissionContext<W>): AdmissionDecision {
    if (!ctx.hasInflight) return { kind: 'accept' }
    return this.policy.decide(ctx)
  }
}
