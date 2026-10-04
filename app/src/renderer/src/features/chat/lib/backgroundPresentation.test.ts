import { describe, expect, it } from 'vitest'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState
} from '../../../../../shared/background-task'
import { backgroundTaskStatus, canStopBackgroundTask } from './backgroundPresentation'
import { backgroundTaskDisplay } from './canonicalBackground'
describe('background card presentation', () => {
  it('keeps raw membership separate from display status while preserving conflicting outcomes', () => {
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
    expect(state.tasks[backgroundKey('g', 'a')].liveMembership).toBe('excluded')
    expect(backgroundTaskStatus(state.tasks[backgroundKey('g', 'a')])).toBe('unknown')
    expect(backgroundTaskDisplay(state, state.tasks[backgroundKey('g', 'a')])).toMatchObject({
      status: 'unconfirmed',
      settled: true
    })
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
    expect(backgroundTaskDisplay(state, task).status).toBe('completed')
    expect(task.terminalEvidence.map((item) => item.status)).toEqual(['completed', 'failed'])
    expect(canStopBackgroundTask(task, 'g', 'connected')).toBe(false)
  })
})
