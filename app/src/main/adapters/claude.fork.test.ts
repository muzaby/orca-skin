// 0064 continuity — TurnRequest.forkFrom 이 SDK query 옵션(resume+forkSession)으로
// 어댑트되는지 배선 단위 검증(claude.effort.test.ts 패턴).
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

type QueryOptions = { resume?: string; forkSession?: boolean }
const lastOptions = (): QueryOptions =>
  (queryMock.mock.calls.at(-1)?.[0] as { options: QueryOptions }).options

describe('ClaudeAdapter — forkFrom (0064)', () => {
  it('forkFrom 을 resume + forkSession:true 로 어댑트한다 (sessionId=null 새 세션 의미론)', () => {
    const adapter = new ClaudeAdapter()
    adapter.sendMessage({ ...baseReq(), forkFrom: 'src-session' })
    expect(lastOptions().resume).toBe('src-session')
    expect(lastOptions().forkSession).toBe(true)
  })

  it('forkFrom 부재 시 기존 resume 경로 무회귀(forkSession 미주입)', () => {
    const adapter = new ClaudeAdapter()
    adapter.sendMessage({ ...baseReq(), sessionId: 'resume-id' })
    expect(lastOptions().resume).toBe('resume-id')
    expect(lastOptions().forkSession).toBeUndefined()

    adapter.sendMessage(baseReq())
    expect(lastOptions().resume).toBeUndefined()
    expect(lastOptions().forkSession).toBeUndefined()
  })
})
