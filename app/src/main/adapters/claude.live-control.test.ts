// 0212 r3 — **어댑터 → SDK 제어 홉의 인자 충실도**(AC25 production path 의 마지막 화살표).
//
// `SessionRuntime.backgroundTask` 가 부르는 포트의 실제 구현이 여기다. 상위 홉을 전부 잠가도
// 이 람다가 인자를 흘리면 다른 태스크가 백그라운드로 간다 — verify r2 가 §10 EP-14 의
// `실패 의미` 로 적은 상태다. 재측정(2026-09-02): `handle.backgroundTasks(toolUseId + '-x')`
// 로 오염시켜도 2798케이스가 전건 초록이었다.
//
// 이 파일이 없으면 `claude.ts:503-507` 세 줄의 인자 전달을 보는 단언이 0이 된다.

import { describe, it, expect, vi } from 'vitest'

const { queryMock, control } = vi.hoisted(() => {
  const control = {
    setModel: vi.fn(async () => {}),
    stopTask: vi.fn(async () => {}),
    backgroundTasks: vi.fn(async () => true),
    setPermissionMode: vi.fn(async () => {}),
    interrupt: vi.fn(async () => undefined)
  }
  return {
    control,
    queryMock: vi.fn(() => {
      const iterable = {
        [Symbol.asyncIterator](): AsyncIterator<never> {
          return { next: async () => ({ done: true, value: undefined as never }) }
        },
        ...control
      }
      return iterable as unknown as AsyncIterable<never>
    })
  }
})

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'
import type { TurnRequest } from './turn'

const baseReq = (): TurnRequest => ({
  sessionId: null,
  text: 'hello',
  cwd: '/tmp',
  extensions: { mcp: {}, skills: [], hooks: { normalized: {} } }
})

describe('ClaudeAdapter — live 제어 위임의 인자 (0212 AC25 경로 끝)', () => {
  // 두 번 부르고 값을 다르게 준다 — 한 번이면 인자를 상수로 굳힌 위임도 통과한다.
  it('backgroundTask 는 받은 toolUseId 로 SDK backgroundTasks 를 부르고 반환을 그대로 돌려준다', async () => {
    const live = new ClaudeAdapter().sendMessage(baseReq())

    expect(await live.backgroundTask('use1')).toBe(true)
    expect(await live.backgroundTask('use2')).toBe(true)

    expect(control.backgroundTasks.mock.calls).toEqual([['use1'], ['use2']])
  })

  it('stopTask·setModel 도 받은 값을 그대로 넘긴다 — 같은 형상의 형제 위임이다', async () => {
    const live = new ClaudeAdapter().sendMessage(baseReq())

    await live.stopTask('task-1')
    await live.stopTask('task-2')
    await live.setModel('opus')
    await live.setModel('sonnet')

    expect(control.stopTask.mock.calls).toEqual([['task-1'], ['task-2']])
    expect(control.setModel.mock.calls).toEqual([['opus'], ['sonnet']])
  })
})
