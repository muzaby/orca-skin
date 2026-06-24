import { describe, expect, it } from 'vitest'
import type { ApprovalResolution, NormalizedEvent } from '../../shared/ipc'
import { runScenario, SCENARIOS, type MockStep } from './mock-scenarios'

const instantSleep = async (): Promise<void> => {}

async function collect(
  steps: MockStep[],
  options: {
    approvals?: ApprovalResolution[]
    aborted?: boolean
    contextUsageRatio?: number
  } = {}
): Promise<{ events: NormalizedEvent[]; approvals: number }> {
  const approvals = [...(options.approvals ?? [])]
  let approvalCount = 0
  const controller = new AbortController()
  if (options.aborted) controller.abort()
  const events: NormalizedEvent[] = []
  for await (const ev of runScenario(steps, {
    sessionId: 's1',
    cwd: '/w',
    contextUsageRatio: options.contextUsageRatio ?? 0.3,
    signal: controller.signal,
    sleep: instantSleep,
    requestApproval: async () => {
      approvalCount += 1
      return approvals.shift() ?? { behavior: 'allow' }
    }
  })) {
    events.push(ev)
  }
  return { events, approvals: approvalCount }
}

describe('mock scenarios', () => {
  it('정의된 시나리오 12종을 제공한다', () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(
      [
        'ask_question',
        'error',
        'full',
        'plan_review',
        'reasoning',
        'subagent_task',
        'subagent_task_aborted',
        'subagent_task_child',
        'subagent_task_multi',
        'subagent_task_running',
        'text_streaming',
        'tool_approval',
        'tool_calls'
      ].sort()
    )
  })

  it('emit 이벤트에 sessionId/cwd 를 주입한다 (코어 중립 0016: provider 미주입)', async () => {
    const { events } = await collect(SCENARIOS.text_streaming)
    expect(events[0]).toEqual({
      type: 'session.updated',
      sessionId: 's1',
      patch: { model: 'mock-sonnet', cwd: '/w' }
    })
    expect(events.every((ev) => ('sessionId' in ev ? ev.sessionId === 's1' : true))).toBe(true)
  })

  it('telemetry ratio 는 컨텍스트 토큰 합으로 변환하고 costUsd 는 0 이다', async () => {
    const zero = await collect(SCENARIOS.text_streaming, { contextUsageRatio: 0 })
    const zeroUsage = zero.events.find((ev) => ev.type === 'telemetry')?.usage
    expect(
      (zeroUsage?.inputTokens ?? 0) +
        (zeroUsage?.cacheReadTokens ?? 0) +
        (zeroUsage?.cacheCreationTokens ?? 0)
    ).toBe(0)
    expect(zeroUsage?.costUsd).toBe(0)
    expect(zeroUsage?.model).toBe('mock-sonnet')

    const high = await collect(SCENARIOS.text_streaming, { contextUsageRatio: 0.95 })
    const highUsage = high.events.find((ev) => ev.type === 'telemetry')?.usage
    expect(
      (highUsage?.inputTokens ?? 0) +
        (highUsage?.cacheReadTokens ?? 0) +
        (highUsage?.cacheCreationTokens ?? 0)
    ).toBe(190_000)
    expect(highUsage?.costUsd).toBe(0)
  })

  it('tool_approval 은 allow/deny 분기를 모두 표현한다', async () => {
    const allowed = await collect(SCENARIOS.tool_approval, {
      approvals: [{ behavior: 'allow' }]
    })
    expect(allowed.approvals).toBe(1)
    expect(allowed.events.some((ev) => ev.type === 'tool.call.started')).toBe(true)

    const denied = await collect(SCENARIOS.tool_approval, {
      approvals: [{ behavior: 'deny', message: 'no' }]
    })
    expect(denied.approvals).toBe(1)
    expect(denied.events.some((ev) => ev.type === 'tool.call.started')).toBe(false)
    expect(denied.events.some((ev) => ev.type === 'message.completed')).toBe(false)
    expect(denied.events.some((ev) => ev.type === 'telemetry')).toBe(false)
  })

  it('abort 된 signal 은 즉시 종료한다', async () => {
    const { events, approvals } = await collect(SCENARIOS.tool_approval, { aborted: true })
    expect(events).toEqual([])
    expect(approvals).toBe(0)
  })

  it('ask_question 은 AskUserQuestion tool.call.started 를 approval 보다 먼저 낸다', async () => {
    const seenBeforeApproval: string[] = []
    const events: NormalizedEvent[] = []
    for await (const ev of runScenario(SCENARIOS.ask_question, {
      sessionId: 's1',
      cwd: '/w',
      contextUsageRatio: 0.3,
      sleep: instantSleep,
      requestApproval: async () => {
        seenBeforeApproval.push(...events.map((e) => e.type))
        return { behavior: 'allow', updatedInput: { answers: { '진행 방식': '빠르게' } } }
      }
    })) {
      events.push(ev)
    }
    expect(seenBeforeApproval).toContain('tool.call.started')
    const ask = events.find((ev) => ev.type === 'tool.call.started')
    expect(ask).toMatchObject({ type: 'tool.call.started', toolName: 'AskUserQuestion' })
  })

  it('plan_review 는 allow / revise / interrupt 분기를 표현한다', async () => {
    const allowed = await collect(SCENARIOS.plan_review, { approvals: [{ behavior: 'allow' }] })
    expect(allowed.events.some((ev) => ev.type === 'tool.call.started')).toBe(true)

    const revised = await collect(SCENARIOS.plan_review, {
      approvals: [{ behavior: 'deny', message: '더 작게' }, { behavior: 'allow' }]
    })
    expect(revised.approvals).toBe(2)
    expect(
      revised.events.some(
        (ev) => ev.type === 'message.completed' && ev.message.text.includes('수정')
      )
    ).toBe(true)

    const interrupted = await collect(SCENARIOS.plan_review, {
      approvals: [{ behavior: 'deny', interrupt: true }]
    })
    expect(interrupted.approvals).toBe(1)
    expect(interrupted.events.some((ev) => ev.type === 'telemetry')).toBe(false)
  })

  it('subagent_task 는 Task 도구 호출과 완료 결과를 낸다', async () => {
    const { events } = await collect(SCENARIOS.subagent_task)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.started',
        toolRunId: 'mock-subagent-task-1',
        toolName: 'Task',
        args: expect.objectContaining({ subagent_type: 'Explore' })
      })
    )
    // 부모 Task tool_result 에 서브에이전트 메타(모델·시간·도구수) 영속.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.completed',
        toolRunId: 'mock-subagent-task-1',
        isError: false,
        subagentMeta: expect.objectContaining({ model: 'claude-haiku-4-5' })
      })
    )
    // subagent.task 라이프사이클(started→…→settled) + 모델 캡처 progress.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'subagent.task',
        toolUseId: 'mock-subagent-task-1',
        phase: 'started'
      })
    )
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'subagent.task',
        toolUseId: 'mock-subagent-task-1',
        phase: 'progress',
        model: 'claude-haiku-4-5'
      })
    )
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'subagent.task',
        toolUseId: 'mock-subagent-task-1',
        phase: 'settled',
        status: 'completed'
      })
    )
    expect(events.at(-1)).toMatchObject({ type: 'telemetry' })
  })

  it('subagent_task_child 는 parentToolRunId 로 child 도구를 연결한다', async () => {
    const { events } = await collect(SCENARIOS.subagent_task_child)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.started',
        toolRunId: 'mock-subagent-child-read',
        parentToolRunId: 'mock-subagent-child-parent'
      })
    )
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.completed',
        toolRunId: 'mock-subagent-child-read',
        parentToolRunId: 'mock-subagent-child-parent'
      })
    )
  })

  it('subagent_task_aborted 는 중단 상태용 isError 결과를 낸다', async () => {
    const { events } = await collect(SCENARIOS.subagent_task_aborted)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.completed',
        toolRunId: 'mock-subagent-aborted-parent',
        isError: true,
        result: expect.objectContaining({ reason: 'aborted' })
      })
    )
  })

  it('subagent_task_multi 는 복수 부모 Task 의 child 를 분리한다', async () => {
    const { events } = await collect(SCENARIOS.subagent_task_multi)
    const childStarts = events.filter(
      (ev) => ev.type === 'tool.call.started' && ev.parentToolRunId !== undefined
    )
    expect(childStarts).toEqual([
      expect.objectContaining({ parentToolRunId: 'mock-subagent-multi-a' }),
      expect.objectContaining({ parentToolRunId: 'mock-subagent-multi-b' })
    ])
  })

  it('error 시나리오는 retryable error 로 종료하고 telemetry 를 내지 않는다', async () => {
    const { events } = await collect(SCENARIOS.error)
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      error: { category: 'stream_error', retryable: true }
    })
    expect(events.some((ev) => ev.type === 'telemetry')).toBe(false)
  })

  it('full 시나리오는 주요 프래그먼트를 거친 뒤 도구 에러 점프로 끝난다', async () => {
    const { events, approvals } = await collect(SCENARIOS.full)
    const types = new Set(events.map((ev) => ev.type))
    if (approvals > 0) {
      types.add('permission.requested')
      types.add('permission.resolved')
    }
    expect(types).toEqual(
      new Set([
        'session.updated',
        'message.delta',
        'message.reasoning',
        'message.reasoning.delta',
        'tool.call.started',
        'tool.call.completed',
        'error',
        'permission.requested',
        'permission.resolved'
      ])
    )
    expect(events.at(-1)).toMatchObject({ type: 'error' })
    expect(events.some((ev) => ev.type === 'telemetry')).toBe(false)
  })
})
