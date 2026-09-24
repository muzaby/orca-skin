import { describe, expect, it } from 'vitest'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState
} from '../../../../../shared/background-task'
import { backgroundTaskStatus, canStopBackgroundTask } from './backgroundPresentation'
describe('background card presentation', () => {
  it('shows excluded unknown separately from completed while preserving conflicting outcomes', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 'a' }]
    })
    state = applyBackgroundEvent(state, {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false },
      tasks: []
    })
    expect(backgroundTaskStatus(state.tasks[backgroundKey('g', 'a')])).toBe('excluded')
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      source: { generation: 'g', sequence: 3, receivedAt: 3, replay: false },
      taskId: 'a',
      phase: 'notification',
      patch: { status: 'completed' }
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      source: { generation: 'g', sequence: 4, receivedAt: 4, replay: false },
      taskId: 'a',
      phase: 'notification',
      patch: { status: 'failed' }
    })
    const task = state.tasks[backgroundKey('g', 'a')]
    expect(backgroundTaskStatus(task)).toBe('completed')
    expect(task.terminalEvidence.map((item) => item.status)).toEqual(['completed', 'failed'])
    expect(canStopBackgroundTask(task, 'g', 'connected')).toBe(false)
  })
})
