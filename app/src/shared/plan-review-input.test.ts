import { describe, expect, it } from 'vitest'
import type { PermissionAction } from './ipc'
import { planReviewToolInput } from './plan-review-input'

describe('plan review input ownership', () => {
  const input = { plan: '# Canonical', planFilePath: 'observed.md', allowedPrompts: [] }
  const action: PermissionAction = {
    kind: 'plan_review',
    request: { requestId: 'ui', plan: '# Canonical' },
    input,
    providerRequest: { requestId: 'sdk', toolUseId: 'exit-1', generation: 'g' }
  }
  it('returns the exact corrected input with its SDK call identity', () => {
    expect(planReviewToolInput(action)).toEqual({ toolUseId: 'exit-1', input })
    expect(planReviewToolInput(action)?.input).toBe(input)
  })
  it.each([
    { ...action, providerRequest: undefined },
    { ...action, providerRequest: { requestId: 'sdk', toolUseId: '' } },
    { ...action, providerRequest: { requestId: 'sdk', toolUseId: 'exit-1', agentId: 'child' } },
    { ...action, input: null },
    { ...action, input: [] },
    {
      kind: 'tool_approval',
      toolName: 'ExitPlanMode',
      input,
      providerRequest: action.providerRequest
    }
  ] as PermissionAction[])('ignores unidentified, child and non-plan requests %#', (other) => {
    expect(planReviewToolInput(other)).toBeUndefined()
  })
})
