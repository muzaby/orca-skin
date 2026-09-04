// AC38 (0215 ΔV4 · EP-29) — 해석된 실행 파일 경로가 **두 query() 호출 모두**에 실린다.
//
// 해석기 자체는 claude-executable.test.ts 가 잠근다. 여기서 보는 것은 배선이다: 한쪽 스프레드가
// 빠지면 그 경로만 SDK 기본 해석으로 돌아가고, dev 에서는 같은 바이너리라 조용히 통과한 뒤
// 패키징에서만 asar spawn 실패로 터진다(0105 의 원래 버그). 두 슬롯을 각각 단언한다.

import { describe, it, expect, vi } from 'vitest'

// vi.mock 팩토리는 호이스팅되므로 sentinel 도 vi.hoisted 로 만든다.
const { SENTINEL, queryMock } = vi.hoisted(() => ({
  SENTINEL: '/bundled/app.asar.unpacked/node_modules/@anthropic-ai/x/claude',
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
vi.mock('./claude-executable', () => ({ resolveClaudeExecutable: () => SENTINEL }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'

function optionsOfFirstCall(): { pathToClaudeCodeExecutable?: string } {
  return (
    queryMock.mock.calls[0]?.[0] as {
      options: { pathToClaudeCodeExecutable?: string }
    }
  ).options
}

describe('claudeExecutableOption 배선', () => {
  it('sendMessage 경로가 해석 결과를 SDK 로 넘긴다', () => {
    queryMock.mockClear()
    const req: TurnRequest = {
      sessionId: null,
      text: 'hello',
      // workspace 가드가 cwd 를 루트로 요구한다(claude.cwd.test.ts 와 같은 최소 형태).
      cwd: '/ws/project',
      extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
    }
    new ClaudeAdapter().sendMessage(req)
    expect(optionsOfFirstCall().pathToClaudeCodeExecutable).toBe(SENTINEL)
  })

  it('complete(runCompletion) 경로도 같은 결과를 넘긴다', async () => {
    queryMock.mockClear()
    await new ClaudeAdapter().complete({ prompt: 'title please' })
    expect(optionsOfFirstCall().pathToClaudeCodeExecutable).toBe(SENTINEL)
  })
})
