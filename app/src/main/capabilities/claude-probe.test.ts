import { describe, it, expect } from 'vitest'
import { CLAUDE_DESCRIPTOR, claudeCapabilityProbe } from './claude-probe'

describe('claude capability probe', () => {
  it('provider id 는 claude-code', () => {
    expect(CLAUDE_DESCRIPTOR.provider).toBe('claude-code')
    expect(claudeCapabilityProbe.provider).toBe('claude-code')
  })

  it('discover() 는 정적 서술자를 반환', async () => {
    await expect(claudeCapabilityProbe.discover()).resolves.toBe(CLAUDE_DESCRIPTOR)
  })

  it('지원 라이프사이클 기능은 true (continue/resume/abort/init/delete/update)', () => {
    const s = CLAUDE_DESCRIPTOR.session
    expect(s.continue).toBe(true)
    expect(s.resume).toBe(true)
    expect(s.abort).toBe(true)
    expect(s.init).toBe(true)
    expect(s.delete).toBe(true)
    expect(s.update).toBe(true)
  })

  it('미확인 기능은 false 로 잠금 (fork/children/summarize/share)', () => {
    const s = CLAUDE_DESCRIPTOR.session
    expect(s.fork).toBe(false)
    expect(s.children).toBe(false)
    expect(s.summarize).toBe(false)
    expect(s.share).toBe(false)
  })

  it('revert 는 전부 false (§5 — claude 대화 revert API 없음)', () => {
    expect(CLAUDE_DESCRIPTOR.revert).toEqual({
      conversationRevert: false,
      conversationUnrevert: false,
      fileCheckpointCreate: false,
      fileCheckpointRestore: false
    })
  })

  it('cancellation.sessionAbort 는 true (AbortController 실존)', () => {
    expect(CLAUDE_DESCRIPTOR.cancellation.sessionAbort).toBe(true)
    expect(CLAUDE_DESCRIPTOR.cancellation.denyInterrupt).toBe(true)
  })
})
