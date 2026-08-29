// EP-08 4번째 좌표 — `TurnRequest.cwd` 가 SDK 옵션 `cwd` 로 그대로 간다.
//
// 앞의 세 좌표(준비 결과 → TurnContext → TurnRequest)는 `app/chat-turn` 에서 잠긴다.
// 여기가 마지막 홉이다: 이 줄이 끊기면 worktree 는 만들어지고 Agent 는 원본 checkout 에서
// 돈다. `workspace-guard` 가 cwd 를 받는다는 사실(claude.extra-dirs.test.ts)은 가드 스코프를
// 말할 뿐 SDK 가 실제로 그 디렉터리에서 도는지는 말하지 않는다 — 두 인자는 다른 자리다.

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

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'

function optionsFor(cwd: string): { cwd?: string } {
  queryMock.mockClear()
  const req: TurnRequest = {
    sessionId: null,
    text: 'hello',
    cwd,
    extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
  }
  new ClaudeAdapter().sendMessage(req)
  return (queryMock.mock.calls[0]?.[0] as { options: { cwd?: string } }).options
}

describe('ClaudeAdapter — TurnRequest.cwd 가 SDK 옵션 cwd 다 (AC5)', () => {
  it('격리 worktree 경로를 그대로 넘긴다', () => {
    expect(optionsFor('/managed/repoid/wtid/packages/web').cwd).toBe(
      '/managed/repoid/wtid/packages/web'
    )
  })

  it('원본 checkout 경로와 구별된다 — 두 값이 같은 자리로 가지 않는다', () => {
    expect(optionsFor('/source/repo').cwd).toBe('/source/repo')
  })
})
