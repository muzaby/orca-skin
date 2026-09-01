import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
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

// ── 0212 — 중단 정착의 사유 키 (AT-21 생산자 축) ──────────────────────────────
//
// 소비자(`taskSurface0212.render.test.ts`)는 손으로 만든 fixture 를 읽으므로 **여기서 그 형태를
// 실제로 만드는지**는 보지 못한다. 그 배선이 빠지면 SDK `task_updated.patch.error` 가 화면까지
// 오지 못하는데도 소비자 단언은 초록으로 남는다.

describe('0212 — stopped 정착의 cause (AT-21)', () => {
  const settleFor = (
    task: Partial<Extract<NormalizedEvent, { type: 'subagent.task' }>>
  ): Record<string, unknown> => {
    const events = createSubagentSettlementEvents({
      sessionId: 's1',
      task: {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'use1',
        phase: 'settled',
        status: 'stopped',
        ...task
      } as Extract<NormalizedEvent, { type: 'subagent.task' }>,
      openToolRuns: []
    })
    const parent = events.find((e) => e.toolRunId === 'use1')
    if (!parent) throw new Error('부모 Task 정착 이벤트가 없다')
    return parent.result as Record<string, unknown>
  }

  it('summary 가 있으면 cause 로 싣는다 — killed 의 patch.error 가 오는 자리다', () => {
    const result = settleFor({ summary: '한도를 초과했습니다' })
    expect(result.cause).toBe('한도를 초과했습니다')
    // `message` 는 건드리지 않는다 — 사용자 중단 행의 표시 문구는 UI 가 소유한다(0204 AT-31).
    expect(result.message).toBe('서브에이전트가 중단되었습니다.')
    expect(result.reason).toBe('aborted')
  })

  it('summary 가 없으면 cause 키를 만들지 않는다 — 소비자가 UI 문구로 떨어진다', () => {
    const result = settleFor({})
    expect('cause' in result).toBe(false)
    // 양성 짝 — 기본 문장은 그대로 실린다(분기 자체가 죽지 않았다).
    expect(result.message).toBe('서브에이전트가 중단되었습니다.')
  })

  it('실패 정착은 여전히 message 에 사유를 싣는다 — 두 축이 갈라지지 않는다', () => {
    const events = createSubagentSettlementEvents({
      sessionId: 's1',
      task: {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'use1',
        phase: 'settled',
        status: 'failed',
        summary: '채널이 종료되었습니다'
      } as Extract<NormalizedEvent, { type: 'subagent.task' }>,
      openToolRuns: []
    })
    const result = events.find((e) => e.toolRunId === 'use1')?.result as Record<string, unknown>
    expect(result.message).toBe('채널이 종료되었습니다')
    expect('cause' in result).toBe(false)
  })
})
