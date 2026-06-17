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
import type { TurnRequest } from '../extensions/types'

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

describe('ClaudeAdapter — effort', () => {
  it('TurnRequest.effort 를 SDK query options 로 전달한다', () => {
    const adapter = new ClaudeAdapter(() => () => undefined)
    adapter.sendMessage({ ...baseReq(), effort: 'xhigh' })

    expect(queryMock).toHaveBeenCalledTimes(1)
    const call = queryMock.mock.calls[0]?.[0] as { options: { effort?: string } } | undefined
    expect(call?.options.effort).toBe('xhigh')
  })
})
