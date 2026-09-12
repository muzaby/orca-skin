import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BackgroundTaskCard, CanonicalBackgroundContent } from './CanonicalBackgroundContent'
import {
  backgroundCallToToolCall,
  backgroundElapsedSeconds,
  requestBackgroundTaskStop,
  shouldActivateBackgroundCard
} from '../../lib/canonicalBackground'
import {
  selectBackgroundItem,
  useBackgroundStore,
  type BackgroundSelection
} from '../../store/backgroundStore'
import { useChatStore } from '../../store/chatStore'
import { chatApi } from '../../../../shared/api/ipc'
import { SubAgentTileHeader } from './SubAgentTileContent'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState,
  type BackgroundTaskRecord
} from '../../../../../../shared/background-task'

function renderState(state: BackgroundSessionState, selection?: BackgroundSelection): string {
  const initial = useChatStore.getInitialState()
  const session = initial.sessions[initial.activeKey].session
  const priorId = session.sessionId
  const backgrounds = useBackgroundStore.getInitialState()
  const priorViews = backgrounds.sessions
  session.sessionId = 's'
  backgrounds.sessions = { s: { state, loading: false, ...(selection ? { selection } : {}) } }
  try {
    return renderToStaticMarkup(createElement(CanonicalBackgroundContent))
  } finally {
    session.sessionId = priorId
    backgrounds.sessions = priorViews
  }
}

function renderHeader(state: BackgroundSessionState, selection?: BackgroundSelection): string {
  const initial = useChatStore.getInitialState()
  const session = initial.sessions[initial.activeKey].session
  const priorId = session.sessionId
  const backgrounds = useBackgroundStore.getInitialState()
  const priorViews = backgrounds.sessions
  session.sessionId = 's'
  backgrounds.sessions = { s: { state, loading: false, ...(selection ? { selection } : {}) } }
  try {
    return renderToStaticMarkup(createElement(SubAgentTileHeader))
  } finally {
    session.sessionId = priorId
    backgrounds.sessions = priorViews
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true)
})

describe('canonical background task cards', () => {
  it('shows a failed Workflow call without task controls, then preserves failure alongside an actual later start', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      toolUseId: 'workflow',
      toolName: 'Workflow',
      phase: 'returned',
      structuredOutput: {
        status: 'async_launched',
        taskId: 'never-started',
        runId: 'run1',
        error: 'syntax error'
      },
      patch: { taskId: 'never-started', runId: 'run1', status: 'failed', mode: 'background' }
    })
    const failed = renderState(state)
    expect(failed).toContain('data-background-call="workflow"')
    expect(failed).toContain('syntax error')
    expect(failed).toContain('실패')
    expect(failed).not.toContain('data-background-task=')
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      taskId: 'never-started',
      phase: 'started',
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false },
      patch: { status: 'running' }
    })
    const started = renderState(state)
    expect(started).toContain('data-background-task="never-started"')
    expect(started).toContain('syntax error')
    expect(started).toContain('role="alert"')
  })
  it('shows one resource URI in selected detail while keeping the three-line list card clean', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      toolUseId: 'mcp',
      toolName: 'mcp__report',
      phase: 'returned',
      patch: {
        taskId: 't',
        outputRefs: [
          {
            id: 'call-camel',
            field: 'resourceLinks',
            value: 'https://example.test/report',
            kind: 'uri'
          },
          {
            id: 'call-snake',
            field: 'resource_links',
            value: 'https://example.test/report',
            kind: 'uri'
          }
        ]
      }
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      taskId: 't',
      toolUseId: 'mcp',
      phase: 'notification',
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false },
      patch: {
        status: 'completed',
        outputRefs: [
          {
            id: 'task-snake',
            field: 'resource_links',
            value: 'https://example.test/report',
            kind: 'uri'
          }
        ]
      }
    })
    const task = state.tasks[backgroundKey('g', 't')]
    expect(task.outputRefs).toHaveLength(3)
    const list = renderState(state)
    expect(list).not.toContain('data-background-output=')
    const detail = renderState(state, { kind: 'task', key: backgroundKey('g', 't') })
    expect(detail.match(/data-background-output=/g)).toHaveLength(1)
  })
  it('renders snapshot-only tasks without a tool call and never injects output markup', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 'standalone', description: '<script>bad()</script>' }]
    })
    const html = renderToStaticMarkup(
      createElement(BackgroundTaskCard, {
        sessionId: 's',
        state,
        task: state.tasks[backgroundKey('g', 'standalone')]
      })
    )
    expect(html).toContain('data-background-task="standalone"')
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('중단')
  })
  it('shows terminal evidence despite live membership and disables stop', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 't' }]
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      taskId: 't',
      phase: 'notification',
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false },
      patch: { status: 'completed' }
    })
    const html = renderToStaticMarkup(
      createElement(BackgroundTaskCard, {
        sessionId: 's',
        state,
        task: state.tasks[backgroundKey('g', 't')]
      })
    )
    expect(html).toContain('완료')
    expect(html).not.toContain('<button')
  })

  it('renders canonical work as the Explorer-style three-line keyboard card', () => {
    vi.setSystemTime(new Date(1_700_000_283_000))
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.task',
      sessionId: 's',
      taskId: 'task-1',
      phase: 'started',
      source: {
        generation: 'generation-1',
        sequence: 1,
        receivedAt: 1_700_000_000_000,
        replay: false
      },
      patch: { status: 'running', description: '로그 파서 조사', toolUses: 3 }
    })

    const html = renderState(state)

    expect(html).toContain('data-background-task="task-1"')
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('로그 파서 조사')
    expect(html).toContain('실행 중')
    expect(html).toContain('4m 43s')
    expect(html).toContain('대화록 보기')
    expect(html).toContain('aria-label="중단"')
    expect(html).not.toContain('새로고침')
    expect(html).not.toContain('모든 실행 중단')
    vi.useRealTimers()
  })

  it('opens the selected Explorer as a transcript without its parent Agent card', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'tool-use-1',
      toolName: 'Agent',
      phase: 'started',
      input: { description: '로그 파서 조사', prompt: '로그 파서를 확인해줘' },
      source: { generation: 'generation-1', sequence: 1, receivedAt: 1, replay: false },
      patch: { taskId: 'task-1', status: 'running', mode: 'background' }
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      taskId: 'task-1',
      toolUseId: 'tool-use-1',
      phase: 'started',
      source: { generation: 'generation-1', sequence: 2, receivedAt: 2, replay: false },
      patch: { status: 'running', description: '로그 파서 조사' }
    })

    const html = renderState(state, {
      kind: 'task',
      key: backgroundKey('generation-1', 'task-1')
    })

    expect(html).toContain('data-background-detail="task-1"')
    expect(html).not.toContain('data-background-tool-call="tool-use-1"')
    expect(html).not.toContain('서브에이전트</')
    expect(html).not.toContain('aria-expanded=')
    expect(html).not.toContain('결과 기다리기')
    expect(html).not.toContain('대기 취소')
    expect(html).toContain('data-subagent-inline="tool-use-1"')
    expect(html).not.toContain('data-background-task="task-1"')
  })

  it('keeps taskless failed calls as selectable cards with the existing tool body detail', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'workflow-1',
      toolName: 'Workflow',
      phase: 'returned',
      input: { workflow: 'nightly' },
      result: { message: 'syntax error' },
      source: { generation: 'generation-1', sequence: 1, receivedAt: 1, replay: false },
      patch: { status: 'failed' }
    })

    const list = renderState(state)
    expect(list).toContain('data-background-call="workflow-1"')
    expect(list).toContain('role="button"')

    const detail = renderState(state, {
      kind: 'call',
      key: backgroundKey('generation-1', 'workflow-1')
    })
    expect(detail).toContain('data-background-call-detail="workflow-1"')
    expect(detail).toContain('syntax error')
    expect(detail).not.toContain('aria-expanded=')
  })

  it('keeps the child transcript for a taskless Agent call with a real toolUseId', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'agent-without-task',
      toolName: 'Agent',
      phase: 'started',
      input: { prompt: '하위 작업' },
      source: { generation: 'generation-1', sequence: 1, receivedAt: 1, replay: false },
      patch: { status: 'running', mode: 'foreground' }
    })

    const detail = renderState(state, {
      kind: 'call',
      key: backgroundKey('generation-1', 'agent-without-task')
    })

    expect(detail).toContain('data-background-call-detail="agent-without-task"')
    expect(detail).toContain('data-subagent-inline="agent-without-task"')
  })

  it('joins a later task to an already-selected call so preserved outputs remain available', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'call-first',
      toolName: 'Bash',
      phase: 'started',
      input: { prompt: '하위 작업' },
      source: { generation: 'generation-1', sequence: 1, receivedAt: 1, replay: false },
      patch: { taskId: 'task-later', status: 'running', mode: 'background' }
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      taskId: 'task-later',
      toolUseId: 'call-first',
      phase: 'notification',
      source: { generation: 'generation-1', sequence: 2, receivedAt: 2, replay: false },
      patch: {
        status: 'completed',
        outputRefs: [
          { id: 'later-output', field: 'output_file', value: 'C:/tmp/result.txt', kind: 'file' }
        ]
      }
    })

    const detail = renderState(state, {
      kind: 'call',
      key: backgroundKey('generation-1', 'call-first')
    })

    expect(detail).toContain('data-background-call-detail="call-first"')
    expect(detail).toContain('data-background-output="later-output"')
  })

  it('maps returned canonical calls to the existing ToolCall result contract', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'bash-1',
      toolName: 'Bash',
      phase: 'returned',
      input: { command: 'echo ok' },
      result: 'ok',
      structuredOutput: { exitCode: 0 },
      source: { generation: 'generation-1', sequence: 1, receivedAt: 1, replay: false },
      patch: { status: 'completed' }
    })

    expect(backgroundCallToToolCall(state.calls[backgroundKey('generation-1', 'bash-1')])).toEqual({
      toolUseId: 'bash-1',
      name: 'Bash',
      input: { command: 'echo ok' },
      result: {
        output: 'ok',
        isError: false,
        structuredOutput: { exitCode: 0 }
      }
    })
  })

  it('sends stop through the exact canonical session/generation/task identity', async () => {
    const stop = vi.spyOn(chatApi, 'stopBackgroundTask').mockResolvedValue()

    const task = {
      ...stateTask('generation-2', 'task-7'),
      toolUseId: 'legacy-tool-use-id'
    }
    await requestBackgroundTaskStop('session-1', task)

    expect(stop).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledWith({
      sessionId: 'session-1',
      generation: 'generation-2',
      taskId: 'task-7'
    })
  })

  it('computes live elapsed from first observation and fixes terminal duration', () => {
    const running = stateTask('g', 't')
    expect(backgroundElapsedSeconds(running, running.firstSeenAt + 283_000)).toBe(283)
    expect(
      backgroundElapsedSeconds(
        { ...running, status: 'completed', durationMs: 8_000 },
        running.firstSeenAt + 283_000
      )
    ).toBe(8)
  })

  it('freezes terminal elapsed at first terminal evidence when the SDK omits duration', () => {
    const running = stateTask('g', 't')
    const terminal = {
      ...running,
      status: 'completed',
      lastSeenAt: running.firstSeenAt + 30_000,
      terminalEvidence: [
        {
          status: 'completed',
          source: {
            generation: 'g',
            sequence: 2,
            receivedAt: running.firstSeenAt + 5_000,
            replay: false
          }
        }
      ]
    }

    expect(backgroundElapsedSeconds(terminal, running.firstSeenAt + 60_000)).toBe(5)
  })

  it('activates only the card itself, never a nested stop control keyboard event', () => {
    const card = {}
    expect(shouldActivateBackgroundCard({ key: 'Enter', target: card, currentTarget: card })).toBe(
      true
    )
    expect(shouldActivateBackgroundCard({ key: ' ', target: card, currentTarget: card })).toBe(true)
    expect(shouldActivateBackgroundCard({ key: 'Enter', target: {}, currentTarget: card })).toBe(
      false
    )
    expect(shouldActivateBackgroundCard({ key: 'Escape', target: card, currentTarget: card })).toBe(
      false
    )
  })
})

function stateTask(generation: string, taskId: string): BackgroundTaskRecord {
  return {
    taskId,
    generation,
    firstSeenAt: 1_700_000_000_000,
    lastSeenAt: 1_700_000_000_000,
    liveMembership: 'included' as const,
    status: 'running',
    terminalEvidence: [],
    outputSnapshots: {},
    outputErrors: {}
  }
}

describe('canonical background selection', () => {
  it('keeps the same task id in different generations and different sessions independent', () => {
    useBackgroundStore.setState({
      sessions: {
        first: { state: emptyBackgroundState(), loading: false },
        second: { state: emptyBackgroundState(), loading: false }
      }
    })

    selectBackgroundItem('first', {
      kind: 'task',
      key: backgroundKey('generation-1', 'same-task')
    })
    selectBackgroundItem('second', {
      kind: 'task',
      key: backgroundKey('generation-2', 'same-task')
    })

    expect(useBackgroundStore.getState().sessions.first.selection).toEqual({
      kind: 'task',
      key: backgroundKey('generation-1', 'same-task')
    })
    expect(useBackgroundStore.getState().sessions.second.selection).toEqual({
      kind: 'task',
      key: backgroundKey('generation-2', 'same-task')
    })
  })

  it('shows back navigation and the task title selected by generation/task key', () => {
    let state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.task',
      sessionId: 's',
      taskId: 'same-task',
      phase: 'started',
      source: { generation: 'generation-1', sequence: 1, receivedAt: 1, replay: false },
      patch: { description: '이전 실행', status: 'running' }
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId: 's',
      taskId: 'same-task',
      phase: 'started',
      source: { generation: 'generation-2', sequence: 1, receivedAt: 2, replay: false },
      patch: { description: '현재 실행', status: 'running' }
    })

    const oldHeader = renderHeader(state, {
      kind: 'task',
      key: backgroundKey('generation-1', 'same-task')
    })
    const currentHeader = renderHeader(state, {
      kind: 'task',
      key: backgroundKey('generation-2', 'same-task')
    })

    expect(oldHeader).toContain('이전 실행')
    expect(oldHeader).not.toContain('현재 실행')
    expect(currentHeader).toContain('현재 실행')
    expect(currentHeader).toContain('aria-label="목록으로"')
  })
})
