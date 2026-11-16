import { describe, expect, it, vi } from 'vitest'
import type { TurnContext } from '../../contracts/turn'
import { ApprovalCoordinator } from './coordinator'

const turn = (dbSessionId: string | null): TurnContext => ({ dbSessionId }) as TurnContext

// 0324 EP-11 — `approval.pending` 의 원천.
describe('ApprovalCoordinator 승인 대기 통지', () => {
  it('승인이 등록될 때마다 그 턴의 세션으로 부른다', () => {
    const pending = vi.fn()
    const approvals = new ApprovalCoordinator(pending)
    const abort = new AbortController()

    void approvals.register('a1', turn('s1'), abort.signal)
    void approvals.register('a2', turn(null), abort.signal)

    expect(pending.mock.calls).toEqual([['s1'], [null]])
    abort.abort()
  })

  it('구독이 없어도 등록은 그대로 된다', async () => {
    const approvals = new ApprovalCoordinator()
    const abort = new AbortController()
    const resolution = approvals.register('a1', turn('s1'), abort.signal)
    abort.abort()
    await expect(resolution).resolves.toMatchObject({ behavior: 'deny' })
  })
})
