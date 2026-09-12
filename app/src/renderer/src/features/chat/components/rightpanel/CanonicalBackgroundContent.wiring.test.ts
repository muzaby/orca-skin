import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanonicalBackgroundContent } from './CanonicalBackgroundContent'
import { SubAgentTileContent, SubAgentTileHeader } from './SubAgentTileContent'
import { selectBackgroundItem, useBackgroundStore } from '../../store/backgroundStore'
import { useChatStore } from '../../store/chatStore'
import { chatApi } from '../../../../shared/api/ipc'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundEventSource,
  type BackgroundSessionState
} from '../../../../../../shared/background-task'

type Props = Record<string, unknown>
const harness = vi.hoisted(() => ({ nodes: [] as { type: unknown; props: Props }[] }))
// Capture the actual DOM callbacks after the real Button and card components render.
vi.mock('react/jsx-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-runtime')>()
  return {
    ...actual,
    jsx: (type: Parameters<typeof actual.jsx>[0], props: Props, key?: string) => {
      harness.nodes.push({ type, props })
      return actual.jsx(type, props, key)
    },
    jsxs: (type: Parameters<typeof actual.jsxs>[0], props: Props, key?: string) => {
      harness.nodes.push({ type, props })
      return actual.jsxs(type, props, key)
    }
  }
})
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      harness.nodes.push({ type: args[0], props: args[1] as Props })
      return actual.jsxDEV(...args)
    }
  }
})

const chatInitial = useChatStore.getInitialState()
const backgroundInitial = useBackgroundStore.getInitialState()
const savedChat = { sessions: chatInitial.sessions, activeKey: chatInitial.activeKey }
const savedBackgrounds = backgroundInitial.sessions
const savedPanels = backgroundInitial.panels
const sessionId = 'canonical-session'
const generation = 'canonical-generation'
const taskId = 'actual-task-id'
const toolUseId = 'different-tool-use-id'
const source = (sequence: number): BackgroundEventSource => ({
  generation,
  sequence,
  receivedAt: sequence,
  replay: false
})

function seed(state: BackgroundSessionState): void {
  const base = savedChat.sessions[savedChat.activeKey]
  const sessions = {
    [sessionId]: {
      ...base,
      session: {
        ...base.session,
        sessionId,
        agentKind: 'code' as const,
        selectedSubagentTaskId: 'unrelated-legacy-selection'
      }
    }
  }
  Object.assign(chatInitial, { activeKey: sessionId, sessions })
  useChatStore.setState({ activeKey: sessionId, sessions })
  const backgrounds = { [sessionId]: { state, loading: false } }
  backgroundInitial.sessions = backgrounds
  backgroundInitial.panels = {}
  useBackgroundStore.setState({ sessions: backgrounds, panels: {} })
}

function render(header = false, legacy = false): string {
  harness.nodes = []
  // React SSR reads the store's initial snapshot; synchronize it between interactions.
  backgroundInitial.sessions = useBackgroundStore.getState().sessions
  backgroundInitial.panels = useBackgroundStore.getState().panels
  chatInitial.sessions = useChatStore.getState().sessions
  chatInitial.activeKey = useChatStore.getState().activeKey
  return renderToStaticMarkup(
    createElement(
      header ? SubAgentTileHeader : legacy ? SubAgentTileContent : CanonicalBackgroundContent
    )
  )
}

function node(type: string, field: string, value: unknown): Props {
  const match = harness.nodes.find((item) => item.type === type && item.props[field] === value)
  expect(match, `missing ${type} ${field}=${String(value)}`).toBeDefined()
  return match!.props
}

function callState(toolName = 'Agent'): BackgroundSessionState {
  return applyBackgroundEvent(emptyBackgroundState(), {
    type: 'background.call',
    sessionId,
    toolUseId,
    toolName,
    phase: 'started',
    input: { description: 'Investigate logs', prompt: 'Read the error log' },
    source: source(1),
    patch: { mode: 'background' }
  })
}

function withTask(state = callState()): BackgroundSessionState {
  return applyBackgroundEvent(state, {
    type: 'background.task',
    sessionId,
    taskId,
    toolUseId,
    phase: 'started',
    source: source(2),
    patch: {
      status: 'running',
      outputRefs: [{ id: 'output-1', field: 'output_file', kind: 'file', value: 'C:/output.txt' }]
    }
  })
}

beforeEach(() => {
  harness.nodes = []
})
afterEach(() => {
  Object.assign(chatInitial, savedChat)
  useChatStore.setState(savedChat)
  backgroundInitial.sessions = savedBackgrounds
  backgroundInitial.panels = savedPanels
  useBackgroundStore.setState({ sessions: savedBackgrounds, panels: savedPanels })
  vi.restoreAllMocks()
})

describe('canonical background production callbacks', () => {
  it('preserves dismissal and collapsed groups through remount and session round trips without leaking the selected header', () => {
    const state = applyBackgroundEvent(withTask(), {
      type: 'background.call',
      sessionId,
      toolUseId: 'done-call',
      toolName: 'Agent',
      phase: 'returned',
      source: source(3),
      patch: { status: 'completed' }
    })
    seed(state)
    render()
    ;(node('button', 'data-background-group-toggle', 'running').onClick as () => void)()
    ;(node('button', 'data-background-clear', 'completed').onClick as () => void)()
    const original = useChatStore.getState().sessions[sessionId]
    useChatStore.setState((store) => ({
      activeKey: 'other-session',
      sessions: {
        ...store.sessions,
        'other-session': {
          ...original,
          session: { ...original.session, sessionId: 'other-session' }
        }
      }
    }))
    useBackgroundStore.setState((store) => ({
      sessions: { ...store.sessions, 'other-session': { state, loading: false } }
    }))
    expect(render()).toContain('data-background-call="done-call"')
    expect(render()).toContain(`data-background-task="${taskId}"`)
    useChatStore.setState({ activeKey: sessionId })
    expect(render()).not.toContain('data-background-call="done-call"')
    expect(node('button', 'data-background-group-toggle', 'running')['aria-expanded']).toBe(false)
    selectBackgroundItem(sessionId, { kind: 'call', key: backgroundKey(generation, 'done-call') })
    expect(render()).not.toContain('data-background-call-detail=')
    expect(render(true)).not.toContain('aria-label="목록으로"')
  })
  it('uses the same group controls and dismissal projection for legacy list, selection, and header', () => {
    seed(emptyBackgroundState())
    const session = useChatStore.getState().sessions[sessionId].session
    session.messages = [
      {
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'legacy-running',
            toolName: 'Agent',
            args: { description: 'still running' }
          },
          {
            type: 'tool_call',
            toolRunId: 'legacy-done',
            toolName: 'Agent',
            args: { description: 'finished legacy' }
          },
          {
            type: 'tool_result',
            toolRunId: 'legacy-done',
            result: 'keep original result',
            isError: false
          }
        ]
      }
    ]
    const original = JSON.stringify(session.messages)
    render(false, true)
    expect(node('button', 'data-background-group-toggle', 'running')['aria-expanded']).toBe(true)
    ;(node('button', 'data-background-group-toggle', 'completed').onClick as () => void)()
    expect(render(false, true)).not.toContain('finished legacy')
    ;(node('button', 'data-background-clear', 'completed').onClick as () => void)()
    expect(render(false, true)).toContain('still running')
    expect(render(false, true)).not.toContain('data-background-group="completed"')
    // A stale direct selection cannot reopen the dismissed card or its header.
    useChatStore.getState().sessions[sessionId].session.selectedSubagentTaskId = 'legacy-done'
    expect(render(false, true)).not.toContain('keep original result')
    expect(render(true, true)).not.toContain('aria-label="목록으로"')
    expect(JSON.stringify(useChatStore.getState().sessions[sessionId].session.messages)).toBe(
      original
    )
  })
  it('independently collapses the two groups and clears only terminal cards through the real controls', () => {
    const state = applyBackgroundEvent(withTask(), {
      type: 'background.call',
      sessionId,
      toolUseId: 'done-call',
      toolName: 'Agent',
      phase: 'returned',
      source: source(3),
      patch: { status: 'completed' }
    })
    seed(state)
    const original = JSON.stringify(state)
    expect(render()).toContain('data-background-call="done-call"')
    const running = node('button', 'data-background-group-toggle', 'running')
    expect(running['aria-expanded']).toBe(true)
    ;(running.onClick as () => void)()
    expect(render()).not.toContain(`data-background-task="${taskId}"`)
    expect(render()).toContain('data-background-call="done-call"')
    const completed = node('button', 'data-background-group-toggle', 'completed')
    ;(completed.onClick as () => void)()
    expect(render()).not.toContain('data-background-call="done-call"')
    expect(node('button', 'data-background-group-toggle', 'running')['aria-expanded']).toBe(false)
    ;(node('button', 'data-background-clear', 'completed').onClick as () => void)()
    expect(render()).not.toContain('data-background-group="completed"')
    ;(node('button', 'data-background-group-toggle', 'running').onClick as () => void)()
    expect(render()).toContain(`data-background-task="${taskId}"`)
    expect(JSON.stringify(useBackgroundStore.getState().sessions[sessionId].state)).toBe(original)
  })
  it('keeps a new completion visible after clearing the previous completed group', () => {
    const done = applyBackgroundEvent(callState(), {
      type: 'background.call',
      sessionId,
      toolUseId,
      phase: 'returned',
      source: source(2),
      patch: { status: 'completed' }
    })
    seed(done)
    render()
    ;(node('button', 'data-background-clear', 'completed').onClick as () => void)()
    const next = applyBackgroundEvent(done, {
      type: 'background.call',
      sessionId,
      toolUseId: 'new-completion',
      toolName: 'Agent',
      phase: 'returned',
      source: source(3),
      patch: { status: 'failed' }
    })
    useBackgroundStore.setState((store) => ({
      sessions: { ...store.sessions, [sessionId]: { ...store.sessions[sessionId], state: next } }
    }))
    expect(render()).toContain('data-background-call="new-completion"')
    expect(render()).not.toContain(`data-background-call="${toolUseId}"`)
  })
  it('opens the clicked task and returns through the real header back callback', () => {
    seed(withTask())
    render()
    const card = node('div', 'data-background-task', taskId)
    ;(card.onClick as () => void)()
    expect(useBackgroundStore.getState().sessions[sessionId].selection).toEqual({
      kind: 'task',
      key: backgroundKey(generation, taskId)
    })
    expect(render()).toContain(`data-subagent-inline="${toolUseId}"`)
    expect(render()).not.toContain('data-background-tool-call=')
    render(true)
    const back = harness.nodes.find(
      (item) => item.type === 'button' && typeof item.props.onClick === 'function'
    )!
    expect(back).toBeDefined()
    ;(back.props.onClick as () => void)()
    expect(useBackgroundStore.getState().sessions[sessionId].selection).toBeUndefined()
    expect(render()).toContain(`data-background-task="${taskId}"`)
  })

  it('sends the actual stop button to canonical IPC without opening the card', async () => {
    const stop = vi.spyOn(chatApi, 'stopBackgroundTask').mockResolvedValue()
    seed(withTask())
    render()
    const button = node('button', 'aria-label', '중단')
    const stopPropagation = vi.fn()
    ;(button.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation })
    await Promise.resolve()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledExactlyOnceWith({ sessionId, generation, taskId })
    expect(useBackgroundStore.getState().sessions[sessionId].selection).toBeUndefined()
  })

  it.each(['Enter', ' '])(
    'isolates a nested stop %j event but activates the card itself',
    (key) => {
      seed(withTask())
      render()
      const card = node('div', 'data-background-task', taskId)
      const onKeyDown = card.onKeyDown as (event: Props) => void
      const cardElement = {}
      const stopElement = {}
      const preventDefault = vi.fn()
      onKeyDown({ key, target: stopElement, currentTarget: cardElement, preventDefault })
      expect(preventDefault).not.toHaveBeenCalled()
      expect(useBackgroundStore.getState().sessions[sessionId].selection).toBeUndefined()
      onKeyDown({ key, target: cardElement, currentTarget: cardElement, preventDefault })
      expect(preventDefault).toHaveBeenCalledOnce()
      expect(useBackgroundStore.getState().sessions[sessionId].selection).toEqual({
        kind: 'task',
        key: backgroundKey(generation, taskId)
      })
    }
  )

  it('keeps an Explorer detail limited to its transcript after a task is associated', () => {
    const state = callState()
    seed(state)
    render()
    const card = node('div', 'data-background-call', toolUseId)
    ;(card.onClick as () => void)()
    expect(render()).toContain(`data-subagent-inline="${toolUseId}"`)
    useBackgroundStore.setState((store) => ({
      sessions: {
        ...store.sessions,
        [sessionId]: { ...store.sessions[sessionId], state: withTask(state) }
      }
    }))
    const detail = render()
    expect(detail).toContain(`data-subagent-inline="${toolUseId}"`)
    expect(detail).not.toContain('data-background-tool-call=')
    expect(detail).not.toContain('data-background-output=')
    expect(
      useBackgroundStore.getState().sessions[sessionId].state.tasks[
        backgroundKey(generation, taskId)
      ].outputRefs
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'output-1' })]))
  })

  it('keeps an opened shell call body-only after it gains a task', () => {
    const state = callState('Bash')
    seed(state)
    render()
    ;(node('div', 'data-background-call', toolUseId).onClick as () => void)()
    useBackgroundStore.setState((store) => ({
      sessions: {
        ...store.sessions,
        [sessionId]: { ...store.sessions[sessionId], state: withTask(state) }
      }
    }))
    expect(render()).not.toContain('data-background-output="output-1"')
  })
})
