import { describe, expect, it } from 'vitest'
import { initialChatState } from '../reducer/chatReducer'
import { generatingSessionKeys, isGeneratingResponse, sameKeys } from './responseProgress'

describe('0254 response progress', () => {
  for (const inflight of [false, true]) {
    for (const ask of [false, true]) {
      for (const plan of [false, true]) {
        for (const tool of [false, true]) {
          it(`inflight=${inflight} ask=${ask} plan=${plan} tool=${tool}`, () => {
            expect(
              isGeneratingResponse({
                inflight,
                pendingAsks: ask ? [{ requestId: 'a', questions: [] }] : [],
                pendingPlanReview: plan ? { requestId: 'p', plan: '#' } : null,
                pendingToolApprovals: tool ? [{ approvalId: 't', toolName: 'Bash', input: {} }] : []
              })
            ).toBe(inflight && !ask && !plan && !tool)
          })
        }
      }
    }
  }
  it('child requests block generation too', () => {
    expect(
      isGeneratingResponse({
        ...initialChatState,
        inflight: true,
        pendingAsks: [
          {
            requestId: 'a',
            questions: [],
            providerRequest: { requestId: 'child', toolUseId: 'use', agentId: 'agent' }
          }
        ]
      })
    ).toBe(false)
  })
  it('sorts generating entry keys including continuity drafts', () => {
    const active = { session: { ...initialChatState, inflight: true } }
    expect(
      generatingSessionKeys({
        z: active,
        'draft:a': active,
        a: active,
        idle: { session: initialChatState }
      })
    ).toEqual(['a', 'draft:a', 'z'])
    expect(sameKeys(['a'], ['a'])).toBe(true)
    expect(sameKeys(['a'], ['b'])).toBe(false)
    expect(sameKeys([], ['a'])).toBe(false)
  })
})
