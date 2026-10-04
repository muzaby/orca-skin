import { describe, expect, it } from 'vitest'
import {
  applyBackgroundEvent,
  backgroundKey,
  countedBackgroundTaskIds,
  emptyBackgroundState,
  type BackgroundCallRecord,
  type BackgroundSessionState,
  type BackgroundTaskRecord
} from '../../../../../shared/background-task'
import {
  backgroundCallKeyForToolUse,
  isBackgroundWork,
  projectBackgroundPanel
} from './canonicalBackground'

const call = (patch: Partial<BackgroundCallRecord> = {}): BackgroundCallRecord => ({
  generation: 'g',
  toolUseId: 'c',
  phase: 'started',
  firstSeenAt: 1,
  lastSeenAt: 1,
  awaitingTask: false,
  toolName: 'Agent',
  ...patch
})
const task = (patch: Partial<BackgroundTaskRecord> = {}): BackgroundTaskRecord => ({
  generation: 'g',
  taskId: 't',
  firstSeenAt: 1,
  lastSeenAt: 1,
  liveMembership: 'unknown',
  terminalEvidence: [],
  outputSnapshots: {},
  outputErrors: {},
  ...patch
})
const state = (): BackgroundSessionState => ({
  ...emptyBackgroundState(),
  generation: 'g',
  connection: 'connected'
})

describe('background work truth table (0249)', () => {
  it.each([
    ['requested', task(), call({ input: { run_in_background: true } })],
    ['task observation', task({ backgroundObserved: true }), call()],
    ['call observation', task(), call({ backgroundObserved: true })],
    ['live membership', task({ liveMembership: 'included' }), call()],
    ['backgrounded task', task({ isBackgrounded: true }), call()],
    ['background mode', task(), call({ mode: 'background' })],
    ['remote mode', task(), call({ mode: 'remote' })]
  ] as const)(
    'accepts %s evidence for every tool family and rejects ambient work',
    (_, work, invocation) => {
      for (const toolName of [
        'Bash',
        'PowerShell',
        'Agent',
        'Task',
        'Monitor',
        'Workflow',
        'mcp__work'
      ]) {
        expect(isBackgroundWork(state(), work, { ...invocation, toolName })).toBe(true)
        expect(
          isBackgroundWork(state(), { ...work, ambient: true }, { ...invocation, toolName })
        ).toBe(false)
      }
    }
  )
  it('accepts a current Spark identity even without historical evidence, but not another generation', () => {
    const live = { ...state(), liveKnown: true, liveTaskIds: ['t'] }
    expect(isBackgroundWork(live, task())).toBe(true)
    expect(isBackgroundWork(live, task({ generation: 'old' }))).toBe(false)
    expect(isBackgroundWork({ ...live, liveKnown: false }, task())).toBe(false)
  })
  it.each(['Agent', 'Task', 'Bash', 'PowerShell', 'Read', 'Monitor', 'Workflow', 'mcp__work'])(
    'rejects foreground and failed %s calls with no background evidence',
    (toolName) => {
      expect(
        isBackgroundWork(
          state(),
          task({ isBackgrounded: false }),
          call({ toolName, mode: 'foreground' })
        )
      ).toBe(false)
      expect(
        isBackgroundWork(
          state(),
          undefined,
          call({ toolName, status: 'failed', phase: 'returned' })
        )
      ).toBe(false)
    }
  )
})

describe('canonical background selection (0249)', () => {
  it.each(['Agent', 'Task'])(
    'opens explicitly selected foreground %s detail without adding a list card',
    (toolName) => {
      const input = state()
      input.tasks[backgroundKey('g', 't')] = task({ toolUseId: 'c', isBackgrounded: false })
      input.calls[backgroundKey('g', 'c')] = call({ toolName, taskId: 't', mode: 'foreground' })
      const selected = projectBackgroundPanel(input, { kind: 'call', key: backgroundKey('g', 'c') })
      expect(selected.tasks).toEqual([])
      expect(selected.calls).toEqual([])
      expect(selected.selectedCall).toBe(input.calls[backgroundKey('g', 'c')])
      expect(selected.selectedTask).toBe(input.tasks[backgroundKey('g', 't')])
      expect(projectBackgroundPanel(input).selectedCall).toBeUndefined()
    }
  )
  it('does not open a hidden failed Read call', () => {
    const input = state()
    input.calls[backgroundKey('g', 'c')] = call({
      toolName: 'Read',
      status: 'failed',
      phase: 'returned'
    })
    expect(
      projectBackgroundPanel(input, { kind: 'call', key: backgroundKey('g', 'c') }).selectedCall
    ).toBeUndefined()
  })
  it('prefers the current generation and otherwise selects the most recently observed matching call', () => {
    const input = state()
    input.calls[backgroundKey('old', 'c')] = call({ generation: 'old', lastSeenAt: 100 })
    input.calls[backgroundKey('g', 'c')] = call({ lastSeenAt: 1 })
    expect(backgroundCallKeyForToolUse(input, 'c')).toBe(backgroundKey('g', 'c'))
    input.generation = 'next'
    expect(backgroundCallKeyForToolUse(input, 'c')).toBe(backgroundKey('old', 'c'))
    expect(backgroundCallKeyForToolUse(input, 'missing')).toBeUndefined()
  })
  it('projects the same running task identities as Spark and moves completed work after the next live set', () => {
    let input = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 'a' }, { taskId: 'b' }, { taskId: 'ambient', ambient: true }]
    })
    expect(
      projectBackgroundPanel(input)
        .tasks.map((t) => t.taskId)
        .sort()
    ).toEqual(countedBackgroundTaskIds(input).sort())
    input = applyBackgroundEvent(input, {
      type: 'background.task',
      sessionId: 's',
      taskId: 'a',
      phase: 'notification',
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false },
      patch: { status: 'completed' }
    })
    input = applyBackgroundEvent(input, {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 3, receivedAt: 3, replay: false },
      tasks: [{ taskId: 'b' }, { taskId: 'ambient', ambient: true }]
    })
    expect(
      projectBackgroundPanel(input)
        .tasks.filter((t) => t.status !== 'completed')
        .map((t) => t.taskId)
    ).toEqual(countedBackgroundTaskIds(input))
    expect(projectBackgroundPanel(input).tasks.find((t) => t.taskId === 'a')?.status).toBe(
      'completed'
    )
    expect(countedBackgroundTaskIds(input)).toHaveLength(1)
  })
})
