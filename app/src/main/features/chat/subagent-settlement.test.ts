import { describe, expect, it } from 'vitest'
import { coerceStoppedToolCompletion, createSubagentSettlementEvents } from './subagent-settlement'

describe('createSubagentSettlementEvents', () => {
  it('stopped 서브에이전트는 부모 Task 와 열린 child 도구를 aborted 로 정착한다', () => {
    const events = createSubagentSettlementEvents({
      sessionId: 's1',
      task: {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'agent-1',
        phase: 'settled',
        status: 'stopped',
        durationMs: 1500,
        toolUses: 2
      },
      openToolRuns: new Map([
        ['agent-1', {}],
        ['child-1', { parentToolRunId: 'agent-1' }],
        ['other-child', { parentToolRunId: 'agent-2' }]
      ])
    })

    expect(events).toEqual([
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'agent-1',
        result: { reason: 'aborted', message: '서브에이전트가 중단되었습니다.' },
        isError: true,
        subagentMeta: { durationMs: 1500, toolUses: 2 }
      },
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'child-1',
        result: { reason: 'aborted', message: '서브에이전트 중단으로 종료됨' },
        isError: true,
        parentToolRunId: 'agent-1'
      }
    ])
  })

  it('completed 서브에이전트는 부모 Task 만 완료로 정착하고 child 도구를 합성하지 않는다', () => {
    const events = createSubagentSettlementEvents({
      sessionId: 's1',
      task: {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'agent-1',
        phase: 'settled',
        status: 'completed',
        summary: 'done'
      },
      openToolRuns: new Map([['child-1', { parentToolRunId: 'agent-1' }]])
    })

    expect(events).toEqual([
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'agent-1',
        result: { summary: 'done' },
        isError: false
      }
    ])
  })

  it('사용자 중단 후 늦게 도착한 부모/child 완료 결과를 aborted 로 강제한다', () => {
    const stopped = new Set(['agent-1'])

    expect(
      coerceStoppedToolCompletion(stopped, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'agent-1',
        result: 'completed anyway',
        isError: false
      })
    ).toMatchObject({
      toolRunId: 'agent-1',
      result: { reason: 'aborted' },
      isError: true
    })

    expect(
      coerceStoppedToolCompletion(stopped, {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'child-1',
        parentToolRunId: 'agent-1',
        result: 'child completed anyway',
        isError: false
      })
    ).toMatchObject({
      toolRunId: 'child-1',
      parentToolRunId: 'agent-1',
      result: { reason: 'aborted' },
      isError: true
    })
  })
})
