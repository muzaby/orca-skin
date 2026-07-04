import { describe, expect, it, vi } from 'vitest'
import {
  AdmissionController,
  RejectDuplicatePolicy,
  type AdmissionPolicy
} from './admission-controller'

describe('AdmissionController', () => {
  it('inflight 가 없으면 정책을 질의하지 않고 accept 한다', () => {
    const rejectDecision = { kind: 'reject', reason: 'duplicate-turn' } as const
    const policy: AdmissionPolicy = {
      decide: vi.fn(() => rejectDecision)
    }
    const controller = new AdmissionController(policy)

    expect(
      controller.admit({
        target: { kind: 'existing-session', sessionId: 's1' },
        hasInflight: false
      })
    ).toEqual({ kind: 'accept' })
    expect(policy.decide).not.toHaveBeenCalled()
  })

  it('기본 정책은 기존 세션의 진행 중 턴을 duplicate reject 로 판단한다', () => {
    const controller = new AdmissionController(new RejectDuplicatePolicy())

    expect(
      controller.admit({
        target: { kind: 'existing-session', sessionId: 's1' },
        hasInflight: true
      })
    ).toEqual({ kind: 'reject', reason: 'duplicate-turn' })
  })

  it('기본 정책은 새-채팅 pending 슬롯도 duplicate reject 로 판단한다', () => {
    const owner = {}
    const controller = new AdmissionController<object>(new RejectDuplicatePolicy())

    expect(
      controller.admit({
        target: { kind: 'new-session-slot', owner },
        hasInflight: true
      })
    ).toEqual({ kind: 'reject', reason: 'duplicate-turn' })
  })

  it('RejectDuplicatePolicy 는 accept/reject 이분 판정이다', () => {
    const policy = new RejectDuplicatePolicy()
    const decisions = [
      policy.decide({ target: { kind: 'existing-session', sessionId: 's1' }, hasInflight: false }),
      policy.decide({ target: { kind: 'existing-session', sessionId: 's1' }, hasInflight: true }),
      policy.decide({ target: { kind: 'new-session-slot', owner: {} }, hasInflight: true })
    ]

    expect(decisions.map((decision) => decision.kind)).toEqual(['accept', 'reject', 'reject'])
  })
})
