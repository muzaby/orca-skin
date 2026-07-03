import { describe, it, expect, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn((req: unknown) => {
    void req
    const iterable = {
      [Symbol.asyncIterator](): AsyncIterator<never> {
        return { next: async () => ({ done: true, value: undefined as never }) }
      }
    } as AsyncIterable<never> & {
      setPermissionMode: () => void
      interrupt: () => void
      setModel: () => void
    }
    iterable.setPermissionMode = vi.fn()
    iterable.interrupt = vi.fn()
    iterable.setModel = vi.fn()
    return iterable
  })
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock
}))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp',
  extensions: {
    mcp: {},
    skills: [],
    hooks: { normalized: {} }
  }
})

describe('ClaudeAdapter — steer echo replay 플래그 (0060 D5)', () => {
  it('sendMessage 는 --replay-user-messages 를 extraArgs(bare flag)로 항상 전달한다', () => {
    // CLI 는 이 플래그 없이는 mid-turn drain 된 steer 를 user echo 로 되돌리지 않는다
    // (직렬화 게이트 기본 off) — echo 기반 커밋(D1)의 전제 조건이라 회귀를 고정한다.
    const adapter = new ClaudeAdapter()
    adapter.sendMessage(baseReq())

    expect(queryMock).toHaveBeenCalledTimes(1)
    const call = queryMock.mock.calls[0]?.[0] as
      | { options: { extraArgs?: Record<string, string | null> } }
      | undefined
    expect(call?.options.extraArgs).toMatchObject({ 'replay-user-messages': null })
  })
})
