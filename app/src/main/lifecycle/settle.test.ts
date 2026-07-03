import { describe, it, expect, vi } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'
import type { TurnContext } from './turn-context'
import { settleOpenToolRuns, settleSubagentTask, stopLiveSubagent } from './settle'

type W = string

function turnWith(openToolRuns: Map<string, { parentToolRunId?: string }>): TurnContext<W> {
  return {
    owner: 'owner-1',
    dbSessionId: 'sess-1',
    openToolRuns
  } as unknown as TurnContext<W>
}

describe('settleOpenToolRuns', () => {
  it('열린 도구를 aborted tool_result 로 turn.event 방출 후 비운다', () => {
    const emit = vi.fn()
    const turn = turnWith(
      new Map([
        ['t1', {}],
        ['t2', { parentToolRunId: 'p' }]
      ])
    )

    settleOpenToolRuns(turn, emit, 'aborted')

    expect(emit).toHaveBeenCalledTimes(2)
    // emit(turn, ev) — 두 번째 인자가 이벤트.
    const ev = emit.mock.calls[0][1] as Extract<NormalizedEvent, { type: 'tool.call.completed' }>
    expect(ev.type).toBe('tool.call.completed')
    expect(ev.isError).toBe(true)
    expect((ev.result as { reason: string }).reason).toBe('aborted')
    // parentToolRunId 보존
    const ev2 = emit.mock.calls[1][1] as { parentToolRunId?: string }
    expect(ev2.parentToolRunId).toBe('p')
    expect(turn.openToolRuns.size).toBe(0)
  })

  it('열린 도구가 없으면 no-op', () => {
    const emit = vi.fn()
    settleOpenToolRuns(turnWith(new Map()), emit, 'failed')
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('settleSubagentTask', () => {
  it('stopped 부모와 그 아래 열린 child 를 정착하고 openToolRuns 에서 제거한다', () => {
    const emit = vi.fn()
    const turn = turnWith(
      new Map([
        ['parent', {}],
        ['child', { parentToolRunId: 'parent' }],
        ['other', {}]
      ])
    )
    const ev = {
      type: 'subagent.task',
      sessionId: 'sess-1',
      toolUseId: 'parent',
      phase: 'settled',
      status: 'stopped'
    } as Extract<NormalizedEvent, { type: 'subagent.task' }>

    settleSubagentTask(turn, emit, ev)

    // 부모 + child 정착(둘 다 turn.event 방출), other 는 부모가 아니므로 유지.
    expect(emit).toHaveBeenCalledTimes(2)
    expect(turn.openToolRuns.has('parent')).toBe(false)
    expect(turn.openToolRuns.has('child')).toBe(false)
    expect(turn.openToolRuns.has('other')).toBe(true)
  })
})

describe('stopLiveSubagent', () => {
  function fakeLive(): {
    live: Parameters<typeof stopLiveSubagent>[0]
    backgroundTask: ReturnType<typeof vi.fn>
    stopTask: ReturnType<typeof vi.fn>
  } {
    const backgroundTask = vi.fn().mockResolvedValue(true)
    const stopTask = vi.fn().mockResolvedValue(undefined)
    return {
      live: { backgroundTask, stopTask } as unknown as Parameters<typeof stopLiveSubagent>[0],
      backgroundTask,
      stopTask
    }
  }

  it('foreground 면 backgroundTask 로 분리 후 stopTask 한다', async () => {
    const { live, backgroundTask, stopTask } = fakeLive()
    await stopLiveSubagent(live, 'tool-1', 'task-1', false)
    expect(backgroundTask).toHaveBeenCalledWith('tool-1')
    expect(stopTask).toHaveBeenCalledWith('task-1')
  })

  it('background 면 backgroundTask 를 건너뛴다', async () => {
    const { live, backgroundTask, stopTask } = fakeLive()
    await stopLiveSubagent(live, 'tool-1', 'task-1', true)
    expect(backgroundTask).not.toHaveBeenCalled()
    expect(stopTask).toHaveBeenCalledWith('task-1')
  })

  it('live 가 없으면 no-op', async () => {
    await expect(stopLiveSubagent(null, 'tool-1', 'task-1', false)).resolves.toBeUndefined()
  })
})
