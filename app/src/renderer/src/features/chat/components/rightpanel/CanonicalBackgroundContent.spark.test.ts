import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { ClaudeBackgroundMapper } from '../../../../../../main/adapters/claude-background'
import { BackgroundTaskTracker } from '../../../../../../main/features/chat/background-tasks'
import {
  applyBackgroundEvent,
  backgroundKey,
  countedBackgroundTaskIds,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../../shared/background-task'
import { backgroundTaskDisplay, projectBackgroundPanel } from '../../lib/canonicalBackground'
import {
  dismissCompletedBackgroundItems,
  useBackgroundStore,
  type BackgroundPanelState
} from '../../store/backgroundStore'
import { useChatStore } from '../../store/chatStore'
import { CanonicalBackgroundContent } from './CanonicalBackgroundContent'

function renderState(state: BackgroundSessionState, panel?: BackgroundPanelState): string {
  const initial = useChatStore.getInitialState()
  const session = initial.sessions[initial.activeKey].session
  const priorId = session.sessionId
  const priorMessages = session.messages
  const backgrounds = useBackgroundStore.getInitialState()
  const priorViews = backgrounds.sessions
  const priorPanels = backgrounds.panels
  session.sessionId = 's'
  session.messages = []
  backgrounds.sessions = { s: { state, loading: false } }
  backgrounds.panels = panel ? { s: panel } : {}
  try {
    return renderToStaticMarkup(createElement(CanonicalBackgroundContent))
  } finally {
    session.sessionId = priorId
    session.messages = priorMessages
    backgrounds.sessions = priorViews
    backgrounds.panels = priorPanels
  }
}

function providerFlow(): {
  emit: (mapper: ClaudeBackgroundMapper, raw: unknown) => BackgroundSessionState
  tracker: BackgroundTaskTracker
} {
  let state = emptyBackgroundState()
  const tracker = new BackgroundTaskTracker()
  const emit = (mapper: ClaudeBackgroundMapper, raw: unknown): BackgroundSessionState => {
    const batch = mapper.map(raw, 's')
    expect(batch).toBeDefined()
    for (const event of batch!.events) {
      if (event.type === 'provider.message') {
        expect(event.interpretationErrors).toBeUndefined()
      } else {
        state = applyBackgroundEvent(state, event)
        tracker.observe(event)
      }
    }
    return state
  }
  return { emit, tracker }
}

function live(taskIds: string[]): unknown {
  return {
    type: 'system',
    subtype: 'background_tasks_changed',
    tasks: taskIds.map((task_id) => ({ task_id }))
  }
}

function assertSpark(state: BackgroundSessionState, tracker: BackgroundTaskTracker): void {
  const actual = projectBackgroundPanel(state)
    .tasks.filter((task) => !backgroundTaskDisplay(state, task).settled)
    .map((task) => task.taskId)
    .sort()
  const counted = countedBackgroundTaskIds(state).sort()
  expect(actual).toEqual(counted)
  expect(tracker.count('s')).toBe(counted.length)
  const $ = load(renderState(state))
  expect(
    $('[data-background-group="running"] [data-background-task]')
      .map((_, card) => $(card).attr('data-background-task'))
      .get()
      .sort()
  ).toEqual(counted)
}

function clearCompleted(state: BackgroundSessionState): BackgroundPanelState {
  const before = JSON.stringify(state)
  useBackgroundStore.setState({ sessions: { s: { state, loading: false } }, panels: {} })
  dismissCompletedBackgroundItems('s')
  expect(useBackgroundStore.getState().sessions.s.state).toBe(state)
  expect(JSON.stringify(state)).toBe(before)
  return useBackgroundStore.getState().panels.s
}

afterEach(() => {
  vi.restoreAllMocks()
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true)
})

describe('0249 ΔV2 actual provider → Spark → background panel', () => {
  function excludedTask(): ReturnType<typeof providerFlow> & {
    mapper: ClaudeBackgroundMapper
    state: BackgroundSessionState
    clock: MockInstance<typeof Date.now>
  } {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const mapper = new ClaudeBackgroundMapper()
    const flow = providerFlow()
    flow.emit(mapper, { type: 'system', subtype: 'init' })
    for (const task_id of ['a', 'b'])
      flow.emit(mapper, {
        type: 'system',
        subtype: 'task_started',
        task_id,
        tool_use_id: `call-${task_id}`,
        task_type: 'local_agent',
        is_backgrounded: true
      })
    assertSpark(flow.emit(mapper, live(['a', 'b'])), flow.tracker)
    clock.mockReturnValue(7000)
    flow.emit(mapper, { type: 'system', subtype: 'task_progress', task_id: 'a' })
    const state = flow.emit(mapper, live(['b']))
    return { ...flow, mapper, state, clock }
  }

  it('settles a live-excluded task in the completed group without inventing terminal evidence', () => {
    const { state, tracker, mapper, clock } = excludedTask()
    const key = backgroundKey(mapper.generation, 'a')
    const task = state.tasks[key]
    expect(task.status).toBe('running')
    expect(task.terminalEvidence).toEqual([])
    expect(task.liveMembership).toBe('excluded')
    expect(backgroundTaskDisplay(state, task)).toEqual({
      status: 'unconfirmed',
      settled: true,
      endedAt: task.lastSeenAt
    })
    assertSpark(state, tracker)
    const $ = load(renderState(state))
    const card = $('[data-background-group="completed"] [data-background-task="a"]')
    expect(card).toHaveLength(1)
    expect(card.text()).toContain('종료 확인 불가')
    expect(card.text()).toContain('6s')
    expect(card.text()).not.toContain('프로세스 종료')
    expect(card.find('button[aria-label="중단"]')).toHaveLength(0)
    clock.mockReturnValue(99000)
    expect(load(renderState(state))('[data-background-task="a"]').text()).toContain('6s')
    const panel = clearCompleted(state)
    expect(panel.dismissedTasks).toContain(key)
    expect(panel.dismissedTasks).not.toContain(backgroundKey(mapper.generation, 'b'))
    const cleared = load(renderState(state, panel))
    expect(cleared('[data-background-task="a"]')).toHaveLength(0)
    expect(cleared('[data-background-task="b"]')).toHaveLength(1)
  })

  it.each(['completed', 'failed', 'stopped'] as const)(
    'replaces unconfirmed with a later real %s notification in the same completed group',
    (status) => {
      const { state: before, emit, mapper, tracker, clock } = excludedTask()
      const key = backgroundKey(mapper.generation, 'a')
      clock.mockReturnValue(8000)
      const state = emit(mapper, {
        type: 'system',
        subtype: 'task_notification',
        task_id: 'a',
        status
      })
      expect(before.tasks[key].status).toBe('running')
      expect(state.tasks[key].status).toBe(status)
      expect(backgroundTaskDisplay(state, state.tasks[key]).status).toBe(status)
      assertSpark(state, tracker)
      const $ = load(renderState(state))
      expect($('[data-background-group="completed"] [data-background-task="a"]')).toHaveLength(1)
      expect($('[data-background-task="a"]').text()).not.toContain('종료 확인 불가')
    }
  )

  it('settles an old-generation remote task after a new provider live snapshot', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const mapper = new ClaudeBackgroundMapper()
    const flow = providerFlow()
    flow.emit(mapper, {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'remote-call', name: 'Agent', input: {} }] }
    })
    flow.emit(mapper, {
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'remote-call', content: 'remote launched' }]
      },
      tool_use_result: { status: 'remote_launched', taskId: 'remote-task' }
    })
    flow.emit(mapper, {
      type: 'system',
      subtype: 'task_started',
      task_id: 'remote-task',
      tool_use_id: 'remote-call',
      task_type: 'remote_agent',
      is_backgrounded: true
    })
    clock.mockReturnValue(7000)
    flow.emit(mapper, { type: 'system', subtype: 'task_progress', task_id: 'remote-task' })
    assertSpark(flow.emit(mapper, live(['remote-task'])), flow.tracker)
    const nextMapper = new ClaudeBackgroundMapper()
    clock.mockReturnValue(9000)
    const state = flow.emit(nextMapper, live([]))
    const key = backgroundKey(mapper.generation, 'remote-task')
    expect(state.tasks[key].status).toBe('running')
    expect(state.tasks[key].terminalEvidence).toEqual([])
    assertSpark(state, flow.tracker)
    const $ = load(renderState(state))
    const card = $('[data-background-group="completed"] [data-background-task="remote-task"]')
    expect(card).toHaveLength(1)
    expect(card.text()).toContain('종료 확인 불가')
    expect(card.text()).toContain('6s')
    expect(card.find('button[aria-label="중단"]')).toHaveLength(0)
    expect(load(renderState(state, clearCompleted(state)))('[data-background-task]')).toHaveLength(
      0
    )
  })

  it('settles and clears an old-generation remote call without fabricating a task', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const mapper = new ClaudeBackgroundMapper()
    const flow = providerFlow()
    flow.emit(mapper, {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'remote-call', name: 'Agent', input: {} }] }
    })
    flow.emit(mapper, {
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'remote-call', content: 'remote launched' }]
      },
      tool_use_result: { status: 'remote_launched' }
    })
    const state = flow.emit(new ClaudeBackgroundMapper(), live([]))
    expect(Object.keys(state.tasks)).toEqual([])
    const $ = load(renderState(state))
    expect($('[data-background-group="running"]')).toHaveLength(0)
    const card = $('[data-background-group="completed"] [data-background-call="remote-call"]')
    expect(card).toHaveLength(1)
    expect(card.text()).toContain('종료 확인 불가')
    expect(load(renderState(state, clearCompleted(state)))('[data-background-call]')).toHaveLength(
      0
    )
  })
})
