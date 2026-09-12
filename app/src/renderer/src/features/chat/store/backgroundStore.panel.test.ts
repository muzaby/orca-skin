import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundEvent,
  type BackgroundEventSource,
  type BackgroundSessionState
} from '../../../../../shared/background-task'
import { chatApi } from '../../../shared/api/ipc'
import { projectBackgroundPanel } from '../lib/canonicalBackground'
import { ClaudeBackgroundMapper } from '../../../../../main/adapters/claude-background'
import {
  dismissCompletedBackgroundItems,
  forgetBackgroundState,
  ingestBackgroundEvent,
  refreshBackgroundState,
  selectBackgroundItem,
  toggleBackgroundGroup,
  useBackgroundStore
} from './backgroundStore'

const source = (sequence: number, generation = 'g'): BackgroundEventSource => ({
  generation,
  sequence,
  receivedAt: sequence,
  replay: false
})
function doneCall(
  sessionId = 's',
  generation = 'g'
): Extract<BackgroundEvent, { type: 'background.call' }> {
  return {
    type: 'background.call',
    sessionId,
    toolUseId: 'call',
    toolName: 'Agent',
    phase: 'returned',
    source: source(1, generation),
    patch: { status: 'completed' }
  }
}
function seed(state: BackgroundSessionState, sessionId = 's'): void {
  useBackgroundStore.setState((store) => ({
    sessions: { ...store.sessions, [sessionId]: { state, loading: false } }
  }))
}
function visible(sessionId = 's'): ReturnType<typeof projectBackgroundPanel> {
  const store = useBackgroundStore.getState()
  const view = store.sessions[sessionId]
  return projectBackgroundPanel(view.state, view.selection, store.panels[sessionId])
}
afterEach(() => {
  useBackgroundStore.setState({ sessions: {}, panels: {} })
  vi.restoreAllMocks()
})

describe('session background panel visibility', () => {
  it.each(['running', 'paused'])(
    'restores a dismissed failed launch when a later task_started proves an actual %s execution',
    (status) => {
      const mapper = new ClaudeBackgroundMapper()
      const emit = (raw: unknown): void => {
        for (const event of mapper.map(raw, 's')!.events) {
          if (event.type !== 'provider.message') ingestBackgroundEvent(event)
        }
      }
      seed(emptyBackgroundState())
      emit({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 'workflow', name: 'Workflow', input: {} }] }
      })
      emit({
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'workflow', content: 'syntax error' }]
        },
        tool_use_result: {
          status: 'async_launched',
          taskId: 'never-started',
          runId: 'run1',
          error: 'syntax error'
        }
      })
      dismissCompletedBackgroundItems('s')
      expect(visible().calls).toHaveLength(0)
      expect(visible().tasks).toHaveLength(0)
      // Merely linking an ID does not establish that execution began.
      emit({
        type: 'system',
        subtype: 'task_updated',
        task_id: 'never-started',
        tool_use_id: 'workflow',
        patch: { description: 'linked only' }
      })
      expect(visible().tasks).toHaveLength(0)
      // task_started can omit status; the real SDK mapper supplies running.
      emit({
        type: 'system',
        subtype: 'task_started',
        task_id: 'never-started',
        tool_use_id: 'workflow'
      })
      if (status === 'paused')
        emit({
          type: 'system',
          subtype: 'task_updated',
          task_id: 'never-started',
          patch: { status: 'paused' }
        })
      expect(visible().tasks).toHaveLength(1)
      expect(visible().tasks[0].status).toBe(status)
      expect(
        useBackgroundStore.getState().sessions.s.state.calls[
          backgroundKey(mapper.generation, 'workflow')
        ].launchFailure
      ).toBeDefined()
      // A later actual completion returns to the already-dismissed terminal identity.
      emit({
        type: 'system',
        subtype: 'task_notification',
        task_id: 'never-started',
        status: 'completed'
      })
      expect(visible().tasks).toHaveLength(0)
    }
  )
  it('dismisses terminal call selection and follows its late task association across refresh', async () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), doneCall())
    seed(state)
    selectBackgroundItem('s', { kind: 'call', key: backgroundKey('g', 'call') })
    dismissCompletedBackgroundItems('s')
    expect(useBackgroundStore.getState().sessions.s.selection).toBeUndefined()
    const event: BackgroundEvent = {
      type: 'background.task',
      sessionId: 's',
      taskId: 'late',
      toolUseId: 'call',
      phase: 'notification',
      source: source(2),
      patch: { status: 'completed' }
    }
    ingestBackgroundEvent(event)
    const original = useBackgroundStore.getState().sessions.s.state
    expect(visible().tasks).toHaveLength(0)
    expect(visible().calls).toHaveLength(0)
    vi.spyOn(chatApi, 'backgroundState').mockResolvedValue(original)
    await refreshBackgroundState('s')
    expect(visible().tasks).toHaveLength(0)
    expect(useBackgroundStore.getState().sessions.s.state).toBe(original)
    expect(original.tasks[backgroundKey('g', 'late')]).toBeDefined()
  })
  it('follows a dismissed task when its invocation arrives late', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.task',
      sessionId: 's',
      taskId: 'task',
      phase: 'notification',
      source: source(1),
      patch: { status: 'failed' }
    })
    seed(state)
    dismissCompletedBackgroundItems('s')
    ingestBackgroundEvent({
      ...doneCall(),
      source: source(2),
      patch: { status: 'failed', taskId: 'task' }
    })
    expect(visible().tasks).toHaveLength(0)
    expect(visible().calls).toHaveLength(0)
  })
  it('preserves pending work, new completions, the same IDs in a new generation, and another session', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), doneCall())
    for (const [index, status] of ['unknown', 'paused', 'running'].entries())
      state = applyBackgroundEvent(state, {
        type: 'background.task',
        sessionId: 's',
        taskId: status,
        phase: 'updated',
        source: source(index + 2),
        patch: { status }
      })
    seed(state)
    seed(applyBackgroundEvent(emptyBackgroundState(), doneCall('other')), 'other')
    toggleBackgroundGroup('s', 'running')
    dismissCompletedBackgroundItems('s')
    expect(
      visible()
        .tasks.map((task) => task.taskId)
        .sort()
    ).toEqual(['paused', 'running', 'unknown'])
    expect(visible('other').calls).toHaveLength(1)
    expect(useBackgroundStore.getState().panels.other).toBeUndefined()
    ingestBackgroundEvent({ ...doneCall(), toolUseId: 'new', source: source(5) })
    ingestBackgroundEvent(doneCall('s', 'next'))
    expect(visible().calls.map((call) => [call.generation, call.toolUseId])).toEqual([
      ['g', 'new'],
      ['next', 'call']
    ])
    expect(useBackgroundStore.getState().panels.s.collapsed?.running).toBe(true)
    forgetBackgroundState('s')
    expect(useBackgroundStore.getState().panels.s).toBeUndefined()
    expect(visible('other').calls).toHaveLength(1)
  })
})
