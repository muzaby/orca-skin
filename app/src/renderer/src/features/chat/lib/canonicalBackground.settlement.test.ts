import { afterEach, describe, expect, it, vi } from 'vitest'
import * as canonicalBackground from './canonicalBackground'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../shared/background-task'
import {
  backgroundCallDisplay,
  backgroundTaskDisplay,
  backgroundCallToToolCall,
  backgroundElapsedSeconds,
  projectBackgroundPanel,
  transcriptResultsByToolUseId
} from './canonicalBackground'
import { dismissCompletedBackgroundItems, useBackgroundStore } from '../store/backgroundStore'
import type { Message } from '../reducer/chatReducer'

function fixture(): BackgroundSessionState {
  const source = { generation: 'g', sequence: 1, receivedAt: 1000, replay: false }
  let state = applyBackgroundEvent(emptyBackgroundState(), {
    type: 'background.call',
    sessionId: 's',
    source,
    phase: 'started',
    toolUseId: 'call',
    toolName: 'Agent',
    input: {}
  })
  state = applyBackgroundEvent(state, {
    type: 'background.task',
    sessionId: 's',
    source: { ...source, sequence: 2 },
    phase: 'started',
    taskId: 'task',
    toolUseId: 'call',
    patch: { status: 'running', isBackgrounded: false, taskType: 'local_agent' }
  })
  return applyBackgroundEvent(state, {
    type: 'background.call',
    sessionId: 's',
    source: { ...source, sequence: 3, receivedAt: 7000 },
    phase: 'returned',
    toolUseId: 'call',
    result: 'ok',
    patch: { status: 'completed' }
  })
}
const key = backgroundKey('g', 'task')
const callKey = backgroundKey('g', 'call')
afterEach(() => {
  vi.restoreAllMocks()
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true)
})

describe('0239 canonical display settlement', () => {
  it('keeps launch failure and canonical success authoritative over transcript metadata in detail', () => {
    const state = fixture()
    const transcript = {
      output: 'not run',
      isError: true,
      nonExecution: { source: 'host' as const, kind: 'no_result' as const }
    }
    const call = {
      ...state.calls[callKey],
      phase: 'started' as const,
      launchFailure: {
        receipt: 'launch failed',
        source: { generation: 'g', sequence: 4, receivedAt: 8000, replay: false }
      }
    }
    expect(backgroundCallDisplay(state, call, transcript).status).toBe('failed')
    expect(backgroundCallToToolCall(call, transcript).result?.nonExecution).toBeUndefined()
    expect(backgroundCallToToolCall(call, transcript).result?.isError).toBe(true)
    const success = { ...state.calls[callKey], phase: 'started' as const }
    expect(backgroundCallDisplay(state, success, transcript).status).toBe('completed')
    expect(backgroundCallToToolCall(success, transcript).result?.nonExecution).toBeUndefined()
  })
  it('settles a foreground task from the parent return without changing canonical evidence', () => {
    const state = fixture()
    const before = JSON.stringify(state)
    const display = backgroundTaskDisplay(state, state.tasks[key])
    expect(display).toEqual({ status: 'completed', settled: true, endedAt: 7000 })
    expect(backgroundElapsedSeconds(state.tasks[key], 99000, display.endedAt)).toBe(6)
    expect(JSON.stringify(state)).toBe(before)
    expect(state.tasks[key].terminalEvidence).toEqual([])
    expect(
      backgroundTaskDisplay(state, {
        ...state.tasks[key],
        isBackgrounded: true,
        backgroundObserved: true
      }).settled
    ).toBe(false)
  })
  it('gives task terminal evidence priority over the parent return', () => {
    const state = fixture()
    const task = {
      ...state.tasks[key],
      status: 'failed',
      terminalEvidence: [
        {
          status: 'failed',
          source: { generation: 'g', sequence: 4, receivedAt: 9000, replay: false }
        }
      ]
    }
    expect(backgroundTaskDisplay(state, task)).toEqual({
      status: 'failed',
      settled: true,
      endedAt: 9000
    })
  })
  it.each(['old-generation', 'terminated'] as const)(
    'settles a nonremote %s task at lastSeenAt',
    (kind) => {
      const state = fixture()
      state.calls = {}
      if (kind === 'old-generation') state.generation = 'next'
      else state.connection = 'terminated'
      const task = { ...state.tasks[key], lastSeenAt: 5000 }
      expect(backgroundTaskDisplay(state, task)).toEqual({
        status: 'unconfirmed',
        settled: true,
        endedAt: 5000
      })
      expect(backgroundElapsedSeconds(task, 99000, 5000)).toBe(4)
      expect(backgroundTaskDisplay(state, { ...task, taskType: 'remote_agent' }).settled).toBe(
        false
      )
      expect(
        backgroundTaskDisplay(state, task, { ...fixture().calls[callKey], mode: 'remote' }).settled
      ).toBe(false)
    }
  )
  it('keeps a current connected task running without a parent receipt', () => {
    const state = fixture()
    state.calls = {}
    expect(backgroundTaskDisplay(state, state.tasks[key])).toMatchObject({
      status: 'running',
      settled: false
    })
  })
  it('settles dead awaitingTask calls but preserves remote calls', () => {
    const state = fixture()
    state.generation = 'next'
    const call = {
      ...state.calls[callKey],
      phase: 'returned' as const,
      status: 'async_launched',
      mode: 'background' as const,
      awaitingTask: true,
      taskId: undefined
    }
    expect(backgroundCallDisplay(state, call)).toEqual({
      status: 'unconfirmed',
      settled: true,
      endedAt: 7000
    })
    expect(backgroundCallDisplay(state, { ...call, mode: 'remote' }).settled).toBe(false)
  })
  it('joins transcript results into missing returns and removes cleared selections', () => {
    const state = fixture()
    state.tasks = {}
    state.calls[callKey] = {
      ...state.calls[callKey],
      phase: 'started',
      status: undefined,
      taskId: undefined
    }
    const messages: Message[] = [
      {
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_result',
            toolRunId: 'call',
            result: 'not run',
            isError: true,
            nonExecution: { source: 'host', kind: 'no_result' }
          }
        ]
      }
    ]
    const results = transcriptResultsByToolUseId(messages)
    expect(backgroundCallDisplay(state, state.calls[callKey], results.get('call'))).toMatchObject({
      status: 'not_executed',
      settled: true
    })
    useBackgroundStore.setState({
      sessions: { s: { state, loading: false, selection: { kind: 'call', key: callKey } } },
      panels: {}
    })
    const projection = vi.spyOn(canonicalBackground, 'projectBackgroundPanel')
    dismissCompletedBackgroundItems('s', [], results)
    expect(projection).toHaveBeenCalledTimes(2)
    expect(projection.mock.calls.map((args) => args[3])).toEqual([results, results])
    const store = useBackgroundStore.getState()
    expect(store.panels.s.dismissedCalls).toContain(callKey)
    expect(store.sessions.s.selection).toBeUndefined()
    expect(projectBackgroundPanel(state, undefined, store.panels.s, results).calls).toEqual([])
    expect(state.calls[callKey].phase).toBe('started')
  })
  it('clears returned foreground tasks with no terminal evidence', () => {
    const state = fixture()
    useBackgroundStore.setState({ sessions: { s: { state, loading: false } }, panels: {} })
    dismissCompletedBackgroundItems('s')
    const panel = useBackgroundStore.getState().panels.s
    expect(panel.dismissedTasks).toContain(key)
    expect(projectBackgroundPanel(state, undefined, panel).tasks).toEqual([])
  })
  it('clears dead nonremote task/call identities while retaining remote and current work', () => {
    const state = fixture()
    state.generation = 'next'
    state.calls = {
      [callKey]: {
        ...state.calls[callKey],
        taskId: undefined,
        phase: 'started',
        status: undefined
      },
      remote: {
        ...state.calls[callKey],
        toolUseId: 'remote',
        taskId: undefined,
        phase: 'started',
        status: undefined,
        mode: 'remote'
      },
      current: {
        ...state.calls[callKey],
        toolUseId: 'current',
        generation: 'next',
        taskId: undefined,
        phase: 'started',
        status: undefined
      }
    }
    state.tasks[key].toolUseId = undefined
    const before = JSON.stringify(state)
    useBackgroundStore.setState({ sessions: { s: { state, loading: false } }, panels: {} })
    dismissCompletedBackgroundItems('s')
    const panel = useBackgroundStore.getState().panels.s
    expect(panel.dismissedTasks).toEqual([key])
    expect(panel.dismissedCalls).toEqual([callKey])
    const projected = projectBackgroundPanel(state, undefined, panel)
    expect(projected.tasks).toEqual([])
    expect(projected.calls.map((call) => call.toolUseId)).toEqual(['remote', 'current'])
    expect(JSON.stringify(state)).toBe(before)
  })
  it.each(['user-rejected', 'cancelled', 'future-kind'])(
    'carries canonical %s metadata into detail ToolCall',
    (kind) => {
      const call = {
        ...fixture().calls[callKey],
        status: 'failed',
        meta: [{ id: 'call', non_execution_kind: kind }]
      }
      expect(backgroundCallToToolCall(call).result?.nonExecution).toEqual({ source: 'sdk', kind })
      expect(backgroundCallDisplay(fixture(), call).status).toBe(
        kind === 'user-rejected' ? 'rejected' : kind === 'cancelled' ? 'cancelled' : 'not_executed'
      )
      expect(
        backgroundCallToToolCall({ ...call, status: 'completed' }).result?.nonExecution
      ).toBeUndefined()
    }
  )
})
