import { describe, expect, it } from 'vitest'
import { ClaudeBackgroundMapper } from './claude-background'
import {
  applyBackgroundEvent,
  backgroundKey,
  canPromoteBackgroundCall,
  emptyBackgroundState,
  type BackgroundEvent,
  type BackgroundSessionState
} from '../../shared/background-task'

function harness(): {
  mapper: ClaudeBackgroundMapper
  events: BackgroundEvent[]
  receive: (raw: unknown) => void
  state: () => BackgroundSessionState
} {
  const mapper = new ClaudeBackgroundMapper()
  const events: BackgroundEvent[] = []
  let state = emptyBackgroundState()
  return {
    mapper,
    events,
    receive: (raw) => {
      for (const event of mapper.map(raw, 's')?.events ?? []) {
        if (event.type === 'provider.message') continue
        events.push(event)
        state = applyBackgroundEvent(state, event)
      }
    },
    state: () => state
  }
}

function startShell(h: ReturnType<typeof harness>, name: string): void {
  h.receive({ type: 'system', subtype: 'init', session_id: 's' })
  h.receive({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id: 'shell', name, input: { command: 'sleep 8' } }] }
  })
  h.receive({
    type: 'system',
    subtype: 'task_started',
    task_id: 'task',
    tool_use_id: 'shell',
    task_type: 'local_bash',
    is_backgrounded: false,
    description: 'foreground shell'
  })
}

describe('SDK foreground shell and actual model evidence', () => {
  it('preserves the observed child model across completion and journal replay without guessing the request', () => {
    const h = harness()
    h.receive({
      type: 'assistant',
      message: {
        model: 'parent-model',
        content: [
          { type: 'tool_use', id: 'agent', name: 'Agent', input: { model: 'requested-model' } }
        ]
      }
    })
    const key = backgroundKey(h.mapper.generation, 'agent')
    expect(h.state().calls[key].model).toBeUndefined()
    h.receive({
      type: 'assistant',
      parent_tool_use_id: 'agent',
      message: {
        model: 'claude-haiku-4-5-20251001',
        content: [{ type: 'text', text: 'child answer' }]
      }
    })
    expect(h.state().calls[key].model).toBe('claude-haiku-4-5-20251001')
    h.receive({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'agent', content: 'done' }] },
      tool_use_result: { status: 'completed' }
    })
    expect(h.state().calls[key]).toMatchObject({
      phase: 'returned',
      model: 'claude-haiku-4-5-20251001'
    })
    const replay = h.events.reduce(
      (state, event) =>
        applyBackgroundEvent(state, {
          ...event,
          source: { ...event.source, replay: true }
        }),
      emptyBackgroundState()
    )
    expect(replay.calls[key].model).toBe('claude-haiku-4-5-20251001')
    expect(replay.generation).toBeUndefined()
  })

  it.each(['Bash', 'PowerShell'])(
    'links the same %s execution when the SDK backgrounds it',
    (name) => {
      const h = harness()
      startShell(h, name)
      const key = backgroundKey(h.mapper.generation, 'shell')
      const taskKey = backgroundKey(h.mapper.generation, 'task')
      expect(canPromoteBackgroundCall(h.state(), h.state().calls[key])).toBe(true)
      expect(h.state().tasks[taskKey].backgroundObserved).not.toBe(true)
      h.receive({
        type: 'system',
        subtype: 'task_updated',
        task_id: 'task',
        patch: { is_backgrounded: true }
      })
      h.receive({
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'shell', content: 'running in the background' }
          ]
        },
        tool_use_result: { backgroundTaskId: 'task', backgroundedByUser: true }
      })
      expect(Object.keys(h.state().tasks)).toEqual([taskKey])
      expect(h.state().calls[key]).toMatchObject({
        taskId: 'task',
        mode: 'background',
        backgroundObserved: true
      })
      expect(canPromoteBackgroundCall(h.state(), h.state().calls[key])).toBe(false)
      h.receive({ type: 'system', subtype: 'background_tasks_changed', tasks: [] })
      h.receive({
        type: 'system',
        subtype: 'task_notification',
        task_id: 'task',
        status: 'completed'
      })
      expect(h.state().tasks[taskKey]).toMatchObject({
        status: 'completed',
        backgroundObserved: true
      })
      const replay = h.events.reduce(
        (state, event) =>
          applyBackgroundEvent(state, {
            ...event,
            source: { ...event.source, replay: true }
          }),
        emptyBackgroundState()
      )
      expect(replay.tasks[taskKey].backgroundObserved).toBe(true)
      expect(canPromoteBackgroundCall(replay, replay.calls[key])).toBe(false)
    }
  )

  it.each(['completed', 'failed', 'stopped'])(
    'never claims a foreground shell became background at %s',
    (status) => {
      const h = harness()
      startShell(h, 'PowerShell')
      h.receive({ type: 'system', subtype: 'task_notification', task_id: 'task', status })
      const state = h.state()
      expect(state.tasks[backgroundKey(h.mapper.generation, 'task')].backgroundObserved).not.toBe(
        true
      )
      expect(state.calls[backgroundKey(h.mapper.generation, 'shell')].backgroundObserved).not.toBe(
        true
      )
      expect(
        canPromoteBackgroundCall(state, state.calls[backgroundKey(h.mapper.generation, 'shell')])
      ).toBe(false)
    }
  )

  it('keeps a snapshot observation after exclusion and late call association', () => {
    const h = harness()
    h.receive({
      type: 'system',
      subtype: 'background_tasks_changed',
      tasks: [{ task_id: 'task', task_type: 'local_bash' }]
    })
    h.receive({ type: 'system', subtype: 'background_tasks_changed', tasks: [] })
    h.receive({
      type: 'system',
      subtype: 'task_started',
      task_id: 'task',
      tool_use_id: 'shell',
      task_type: 'local_bash'
    })
    h.receive({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'shell', name: 'PowerShell', input: {} }] }
    })
    expect(h.state().tasks[backgroundKey(h.mapper.generation, 'task')].backgroundObserved).toBe(
      true
    )
    expect(h.state().calls[backgroundKey(h.mapper.generation, 'shell')].backgroundObserved).toBe(
      true
    )
  })

  it('does not promote an unregistered, requested-background, disconnected, or stale call', () => {
    const h = harness()
    h.receive({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'pending', name: 'Bash', input: { run_in_background: true } }
        ]
      }
    })
    const pending = h.state().calls[backgroundKey(h.mapper.generation, 'pending')]
    expect(pending.backgroundObserved).not.toBe(true)
    expect(canPromoteBackgroundCall(h.state(), pending)).toBe(false)
    startShell(h, 'Bash')
    const call = h.state().calls[backgroundKey(h.mapper.generation, 'shell')]
    expect(canPromoteBackgroundCall({ ...h.state(), connection: 'disconnected' }, call)).toBe(false)
    expect(canPromoteBackgroundCall({ ...h.state(), generation: 'new' }, call)).toBe(false)
  })
})
