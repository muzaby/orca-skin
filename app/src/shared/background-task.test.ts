import { describe, expect, it } from 'vitest'
import {
  applyBackgroundEvent,
  backgroundPending,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundEvent,
  type BackgroundEventSource
} from './background-task'

let sequence = 0
const source = (generation = 'g1', replay = false): BackgroundEventSource => ({
  generation,
  replay,
  sequence: ++sequence,
  receivedAt: sequence
})
const snapshot = (ids: string[], generation = 'g1'): BackgroundEvent => ({
  type: 'background.snapshot',
  sessionId: 's',
  source: source(generation),
  tasks: ids.map((taskId) => ({ taskId }))
})
const task = (taskId: string, status: string, generation = 'g1'): BackgroundEvent => ({
  type: 'background.task',
  sessionId: 's',
  source: source(generation),
  taskId,
  phase: 'updated',
  patch: { status }
})

describe('canonical background state', () => {
  it('keeps Workflow launch failure as a call even when the receipt includes a taskId', () => {
    const receipt = {
      status: 'async_launched',
      taskId: 'never-started',
      runId: 'run1',
      error: 'syntax error'
    }
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      source: source(),
      toolUseId: 'workflow',
      toolName: 'Workflow',
      phase: 'returned',
      structuredOutput: receipt,
      patch: { taskId: 'never-started', runId: 'run1', status: 'failed', mode: 'background' }
    })
    expect(Object.keys(state.tasks)).toEqual([])
    expect(backgroundPending(state)).toBe(false)
    expect(state.calls[backgroundKey('g1', 'workflow')]).toMatchObject({
      status: 'failed',
      awaitingTask: false,
      structuredOutput: receipt
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      source: source(),
      taskId: 'never-started',
      phase: 'started',
      patch: { status: 'running' }
    })
    expect(state.tasks[backgroundKey('g1', 'never-started')]).toMatchObject({
      status: 'running',
      toolUseId: 'workflow'
    })
    expect(state.calls[backgroundKey('g1', 'workflow')].structuredOutput).toEqual(receipt)
    state = applyBackgroundEvent(state, {
      type: 'background.call',
      sessionId: 's',
      source: source(),
      toolUseId: 'workflow',
      phase: 'returned',
      structuredOutput: { status: 'completed' },
      patch: { status: 'completed' }
    })
    expect(state.calls[backgroundKey('g1', 'workflow')].launchFailure?.receipt).toEqual(receipt)
    expect(state.tasks[backgroundKey('g1', 'never-started')].status).toBe('running')
  })
  it('keeps explicit launch pending until its first live snapshot', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      source: source(),
      toolUseId: 'c',
      phase: 'returned',
      patch: { taskId: 't', mode: 'background', status: 'async_launched' }
    })
    expect(backgroundPending(state)).toBe(true)
    expect(backgroundPending(applyBackgroundEvent(state, snapshot([])))).toBe(false)
  })
  it('replayed completion cannot settle the same current task', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), task('a', 'running'))
    const replay = task('a', 'completed')
    state = applyBackgroundEvent(state, { ...replay, source: { ...replay.source, replay: true } })
    expect(state.tasks[backgroundKey('g1', 'a')].status).toBe('running')
    expect(state.tasks[backgroundKey('g1', 'a')].terminalEvidence).toEqual([])
  })
  it('creates snapshot-only tasks, replaces membership without guessing termination', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), snapshot(['a', 'b']))
    expect(state.liveTaskIds).toEqual(['a', 'b'])
    state = applyBackgroundEvent(state, snapshot(['b']))
    expect(state.tasks[backgroundKey('g1', 'a')]).toMatchObject({
      liveMembership: 'excluded',
      terminalEvidence: []
    })
  })
  it('keeps terminal evidence through delayed start and conflicting completion', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), task('a', 'killed'))
    state = applyBackgroundEvent(state, task('a', 'running'))
    state = applyBackgroundEvent(state, task('a', 'completed'))
    expect(state.tasks[backgroundKey('g1', 'a')].status).toBe('killed')
    expect(state.tasks[backgroundKey('g1', 'a')].terminalEvidence.map((x) => x.status)).toEqual([
      'killed',
      'completed'
    ])
  })
  it('preserves a terminal task still present in live membership', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), snapshot(['a']))
    state = applyBackgroundEvent(state, task('a', 'completed'))
    expect(state.liveTaskIds).toEqual(['a'])
    expect(state.tasks[backgroundKey('g1', 'a')].liveMembership).toBe('included')
  })
  it('keeps no-task-id Agent launch as a call and binds only explicit toolUseId', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      source: source(),
      toolUseId: 'tool',
      toolName: 'Agent',
      phase: 'returned',
      patch: { agentId: 'agent', status: 'async_launched', mode: 'background' }
    })
    expect(Object.values(state.tasks)).toHaveLength(0)
    expect(state.calls[backgroundKey('g1', 'tool')].awaitingTask).toBe(true)
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      source: source(),
      taskId: 'task',
      toolUseId: 'tool',
      phase: 'started',
      patch: {}
    })
    expect(state.calls[backgroundKey('g1', 'tool')].taskId).toBe('task')
    expect(state.tasks[backgroundKey('g1', 'task')].agentId).toBe('agent')
  })
  it('deduplicates identical UUID/payload but accepts amended payload and zero values', () => {
    const ev: BackgroundEvent = {
      type: 'background.task',
      sessionId: 's',
      source: { ...source(), uuid: 'u' },
      taskId: 'a',
      phase: 'updated',
      patch: { isBackgrounded: true, durationMs: 3 }
    }
    let state = applyBackgroundEvent(emptyBackgroundState(), ev)
    expect(applyBackgroundEvent(state, { ...ev, source: { ...source(), uuid: 'u' } })).toBe(state)
    state = applyBackgroundEvent(state, {
      ...ev,
      source: { ...source(), uuid: 'u' },
      patch: { isBackgrounded: false, durationMs: 0, description: '' }
    })
    expect(state.tasks[backgroundKey('g1', 'a')]).toMatchObject({
      isBackgrounded: false,
      durationMs: 0,
      description: ''
    })
  })
  it('resets live on new generation and ignores old replay currentness', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), snapshot(['old']))
    state = applyBackgroundEvent(state, {
      type: 'background.connection',
      sessionId: 's',
      source: source('g2'),
      state: 'connected'
    })
    state = applyBackgroundEvent(state, {
      type: 'background.connection',
      sessionId: 's',
      source: source('g1', true),
      state: 'terminated'
    })
    expect(state.generation).toBe('g2')
    expect(state.connection).toBe('connected')
    expect(state.liveTaskIds).toEqual([])
  })
  it('stop ACK and output failure do not change completed result', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), task('a', 'completed'))
    state = applyBackgroundEvent(state, {
      type: 'background.control',
      sessionId: 's',
      source: source(),
      taskId: 'a',
      state: 'acknowledged'
    })
    state = applyBackgroundEvent(state, {
      type: 'background.output',
      sessionId: 's',
      source: source(),
      taskId: 'a',
      outputId: 'o',
      error: 'missing'
    })
    expect(state.tasks[backgroundKey('g1', 'a')]).toMatchObject({
      status: 'completed',
      stop: { state: 'acknowledged' },
      outputErrors: { o: 'missing' }
    })
  })
  it('reinitialize requires a fresh snapshot to restore connected state', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.connection',
      sessionId: 's',
      source: source(),
      state: 'resynchronizing'
    })
    expect(state.liveKnown).toBe(false)
    state = applyBackgroundEvent(state, snapshot(['a']))
    expect(state.connection).toBe('connected')
    expect(state.liveKnown).toBe(true)
  })
  it('keeps retry across heartbeats and preserves zero elapsed time', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      source: source(),
      toolUseId: 'c',
      phase: 'progress',
      patch: { retry: { attempt: 1 } }
    })
    state = applyBackgroundEvent(state, {
      type: 'background.call',
      sessionId: 's',
      source: source(),
      toolUseId: 'c',
      phase: 'progress',
      patch: { heartbeat: true, elapsedTimeSeconds: 0 }
    })
    expect(state.calls[backgroundKey('g1', 'c')]).toMatchObject({
      retry: { attempt: 1 },
      elapsedTimeSeconds: 0
    })
  })
})
