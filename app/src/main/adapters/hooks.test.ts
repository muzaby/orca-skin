import { describe, it, expect } from 'vitest'
import { resolveHookDecisions, type NormalizedHookDecision } from './hooks'

describe('resolveHookDecisions', () => {
  it('빈 배열은 빈 결정', () => {
    expect(resolveHookDecisions([])).toEqual({})
  })

  it('단일 allow 는 그대로', () => {
    expect(resolveHookDecisions([{ decision: 'allow' }])).toEqual({ decision: 'allow' })
  })

  it('deny > ask > allow — 가장 제한적인 결정 채택', () => {
    const decisions: NormalizedHookDecision[] = [
      { decision: 'allow' },
      { decision: 'deny', reason: 'blocked' },
      { decision: 'ask' }
    ]
    const merged = resolveHookDecisions(decisions)
    expect(merged.decision).toBe('deny')
    expect(merged.reason).toBe('blocked')
  })

  it('ask 는 allow 를 이기지만 deny 에는 진다', () => {
    expect(resolveHookDecisions([{ decision: 'ask' }, { decision: 'allow' }]).decision).toBe('ask')
  })

  it('injectContext 는 모든 핸들러 것을 줄바꿈으로 연결', () => {
    const merged = resolveHookDecisions([
      { injectContext: 'first' },
      { decision: 'allow' },
      { injectContext: 'second' }
    ])
    expect(merged.injectContext).toBe('first\nsecond')
  })

  it('continue:false 는 전파된다 (하나라도 false 면 false)', () => {
    expect(resolveHookDecisions([{ continue: true }, { continue: false }]).continue).toBe(false)
    expect(resolveHookDecisions([{ decision: 'allow' }]).continue).toBeUndefined()
  })

  it('updatedToolInput 은 last-writer-wins', () => {
    const merged = resolveHookDecisions([
      { updatedToolInput: { a: 1 } },
      { updatedToolInput: { b: 2 } }
    ])
    expect(merged.updatedToolInput).toEqual({ b: 2 })
  })

  it('updatedToolOutput 도 last-writer-wins', () => {
    const merged = resolveHookDecisions([
      { updatedToolOutput: 'one' },
      { updatedToolOutput: 'two' }
    ])
    expect(merged.updatedToolOutput).toBe('two')
  })
})
