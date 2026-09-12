import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BackgroundTaskCard, CanonicalBackgroundContent } from './CanonicalBackgroundContent'
import { useBackgroundStore } from '../../store/backgroundStore'
import { useChatStore } from '../../store/chatStore'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundSessionState
} from '../../../../../../shared/background-task'
import { agentUiPolicy } from '../../lib/agentPresentation'

function renderState(state: BackgroundSessionState): string {
  const initial = useChatStore.getInitialState()
  const session = initial.sessions[initial.activeKey].session
  const priorId = session.sessionId
  const backgrounds = useBackgroundStore.getInitialState()
  const priorViews = backgrounds.sessions
  session.sessionId = 's'
  backgrounds.sessions = { s: { state, loading: false } }
  try {
    return renderToStaticMarkup(createElement(CanonicalBackgroundContent))
  } finally {
    session.sessionId = priorId
    backgrounds.sessions = priorViews
  }
}

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
  it('shows one resource URI for linked task/call aliases while keeping each source ref', () => {
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
    const html = renderToStaticMarkup(
      createElement(BackgroundTaskCard, {
        sessionId: 's',
        state,
        task,
        call: state.calls[backgroundKey('g', 'mcp')],
        transcriptPolicy: agentUiPolicy('code').transcript
      })
    )
    expect(html.match(/data-background-output=/g)).toHaveLength(1)
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
        task: state.tasks[backgroundKey('g', 'standalone')],
        transcriptPolicy: agentUiPolicy('code').transcript
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
        task: state.tasks[backgroundKey('g', 't')],
        transcriptPolicy: agentUiPolicy('code').transcript
      })
    )
    expect(html).toContain('완료')
    expect(html).not.toContain('<button')
  })
})
