import { describe, it, expect } from 'vitest'
import { ClaudeAdapter } from './claude'
import { CLAUDE_DESCRIPTOR } from '../capabilities/claude-probe'

const adapter = new ClaudeAdapter(() => () => undefined)

describe('ClaudeAdapter.describe', () => {
  it('describe() 는 단일 출처 CLAUDE_DESCRIPTOR 를 반환(drift 없음)', () => {
    expect(adapter.describe()).toBe(CLAUDE_DESCRIPTOR)
  })

  it('서술자 provider 는 어댑터 id 와 일치', () => {
    expect(adapter.describe().provider).toBe(adapter.id)
  })
})
