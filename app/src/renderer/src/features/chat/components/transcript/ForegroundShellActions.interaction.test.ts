import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForegroundShellActions } from './ForegroundShellActions'
import { ToolCard } from './ToolCard'
import { useBackgroundStore } from '../../store/backgroundStore'
import { useChatStore } from '../../store/chatStore'
import { chatApi } from '../../../../shared/api/ipc'
import { agentUiPolicy } from '../../lib/agentPresentation'
import {
  applyBackgroundEvent,
  emptyBackgroundState,
  type BackgroundEventSource,
  type BackgroundSessionState
} from '../../../../../../shared/background-task'
import type { ToolCall } from '../../reducer/chatReducer'

type Props = Record<string, unknown>
const harness = vi.hoisted(() => ({
  nodes: [] as { type: unknown; props: Props }[],
  slots: [] as unknown[],
  cursor: 0
}))

// Keep hook state across explicit SSR rerenders so the real click callback's pending/error states are observable.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useState: <T>(initial: T | (() => T)) => {
      const index = harness.cursor++
      if (!(index in harness.slots)) {
        harness.slots[index] = typeof initial === 'function' ? (initial as () => T)() : initial
      }
      const set = (next: T | ((value: T) => T)): void => {
        const current = harness.slots[index] as T
        harness.slots[index] =
          typeof next === 'function' ? (next as (value: T) => T)(current) : next
      }
      return [harness.slots[index] as T, set] as const
    }
  }
})
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
const sessionId = 'foreground-session'
const generation = 'foreground-generation'
const source = (sequence: number): BackgroundEventSource => ({
  generation,
  sequence,
  receivedAt: sequence,
  replay: false
})

function runningShellState(...toolUseIds: string[]): BackgroundSessionState {
  let state = applyBackgroundEvent(emptyBackgroundState(), {
    type: 'background.connection',
    sessionId,
    state: 'connected',
    source: source(1)
  })
  toolUseIds.forEach((toolUseId, index) => {
    const sequence = index * 2 + 2
    state = applyBackgroundEvent(state, {
      type: 'background.call',
      sessionId,
      toolUseId,
      toolName: index % 2 === 0 ? 'Bash' : 'PowerShell',
      phase: 'started',
      input: { command: `sleep ${index + 1}` },
      patch: { taskId: `task-${toolUseId}`, mode: 'foreground', status: 'running' },
      source: source(sequence)
    })
    state = applyBackgroundEvent(state, {
      type: 'background.task',
      sessionId,
      taskId: `task-${toolUseId}`,
      toolUseId,
      phase: 'started',
      patch: { taskType: 'local_bash', status: 'running', isBackgrounded: false },
      source: source(sequence + 1)
    })
  })
  return state
}

function call(toolUseId: string, name: 'Bash' | 'PowerShell' = 'Bash'): ToolCall {
  return { toolUseId, name, input: { command: 'sleep 9' } }
}

function seed(state: BackgroundSessionState, kind: 'code' | 'work' = 'code'): void {
  const base = savedChat.sessions[savedChat.activeKey]
  const sessions = {
    [sessionId]: {
      ...base,
      session: { ...base.session, sessionId, agentKind: kind, rightPanelTiles: [] }
    }
  }
  Object.assign(chatInitial, { activeKey: sessionId, sessions })
  useChatStore.setState({ activeKey: sessionId, sessions })
  const backgrounds = { [sessionId]: { state, loading: false } }
  backgroundInitial.sessions = backgrounds
  useBackgroundStore.setState({ sessions: backgrounds })
}

function render(...calls: ToolCall[]): string {
  harness.nodes = []
  harness.cursor = 0
  backgroundInitial.sessions = useBackgroundStore.getState().sessions
  return renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      ...calls.map((item) =>
        createElement(ForegroundShellActions, { key: item.toolUseId, call: item })
      )
    )
  )
}

function buttons(): Props[] {
  return harness.nodes
    .filter((item) => item.type === 'button' && item.props.children === '백그라운드 전환')
    .map((item) => item.props)
}

function renderToolCard(item: ToolCall, presentation: 'row' | 'detail-body' = 'row'): string {
  harness.nodes = []
  harness.cursor = 0
  backgroundInitial.sessions = useBackgroundStore.getState().sessions
  return renderToStaticMarkup(
    createElement(ToolCard, {
      call: item,
      transcriptPolicy: agentUiPolicy('code').transcript,
      presentation
    })
  )
}

beforeEach(() => {
  harness.nodes = []
  harness.slots = []
  harness.cursor = 0
})

afterEach(() => {
  Object.assign(chatInitial, savedChat)
  useChatStore.setState(savedChat)
  backgroundInitial.sessions = savedBackgrounds
  useBackgroundStore.setState({ sessions: savedBackgrounds })
  vi.restoreAllMocks()
})

describe('foreground shell promotion action', () => {
  it('promotes each exact running shell once and opens the Code background panel after success', async () => {
    seed(runningShellState('bash-id', 'powershell-id'))
    let release!: () => void
    const first = new Promise<void>((resolve) => {
      release = resolve
    })
    const promote = vi
      .spyOn(chatApi, 'promoteBackgroundTask')
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce()

    render(call('bash-id'), call('powershell-id', 'PowerShell'))
    const [bash, powershell] = buttons()
    expect(bash.disabled).toBe(false)
    expect(powershell.disabled).toBe(false)
    ;(bash.onClick as () => void)()
    ;(bash.onClick as () => void)()
    expect(promote).toHaveBeenCalledTimes(1)
    expect(promote).toHaveBeenNthCalledWith(1, { sessionId, generation, toolUseId: 'bash-id' })
    render(call('bash-id'), call('powershell-id', 'PowerShell'))
    expect(buttons()[0].disabled).toBe(true)
    release()
    await vi.waitFor(() => {
      const tiles = useChatStore
        .getState()
        .sessions[sessionId].session.rightPanelTiles.flatMap((column) => column.tiles)
      expect(tiles).toContain('subagent')
    })

    ;(powershell.onClick as () => void)()
    await vi.waitFor(() => expect(promote).toHaveBeenCalledTimes(2))
    expect(promote).toHaveBeenNthCalledWith(2, {
      sessionId,
      generation,
      toolUseId: 'powershell-id'
    })
  })

  it('shows a short retryable local error when the backend rejects', async () => {
    seed(runningShellState('retry-id'))
    const promote = vi
      .spyOn(chatApi, 'promoteBackgroundTask')
      .mockRejectedValueOnce(new Error('not registered'))
      .mockResolvedValueOnce()
    render(call('retry-id'))
    ;(buttons()[0].onClick as () => void)()
    await vi.waitFor(() => expect(harness.slots).toContain('백그라운드로 전환하지 못했습니다.'))

    expect(render(call('retry-id'))).toContain('백그라운드로 전환하지 못했습니다.')
    const retry = buttons()[0]
    expect(retry.disabled).toBe(false)
    ;(retry.onClick as () => void)()
    await vi.waitFor(() => expect(promote).toHaveBeenCalledTimes(2))
  })

  it('does not open a different session panel when the successful response arrives late', async () => {
    seed(runningShellState('late-id'))
    let release!: () => void
    vi.spyOn(chatApi, 'promoteBackgroundTask').mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      })
    )
    render(call('late-id'))
    ;(buttons()[0].onClick as () => void)()

    const state = useChatStore.getState()
    const other = {
      ...state.sessions[sessionId],
      session: {
        ...state.sessions[sessionId].session,
        sessionId: 'other-session',
        rightPanelTiles: []
      }
    }
    useChatStore.setState({
      activeKey: 'other-session',
      sessions: { ...state.sessions, 'other-session': other }
    })
    release()
    await Promise.resolve()
    await Promise.resolve()

    expect(useChatStore.getState().sessions['other-session'].session.rightPanelTiles).toEqual([])
    expect(useChatStore.getState().sessions[sessionId].session.rightPanelTiles).toEqual([])
  })

  it('disables unregistered foreground shells and hides terminal, background, and Work actions', () => {
    seed(runningShellState('visible-id'))
    render(call('unregistered-id'))
    expect(buttons()).toHaveLength(1)
    expect(buttons()[0].disabled).toBe(true)

    const view = useBackgroundStore.getState().sessions[sessionId]
    useBackgroundStore.setState({
      sessions: {
        [sessionId]: { ...view, state: { ...view.state, connection: 'disconnected' } }
      }
    })
    render(call('visible-id'))
    expect(buttons()[0].disabled).toBe(true)

    useBackgroundStore.setState({
      sessions: {
        [sessionId]: { ...view, state: { ...view.state, generation: 'new-generation' } }
      }
    })
    render(call('visible-id'))
    expect(buttons()[0].disabled).toBe(true)

    const completed = { ...call('visible-id'), result: { output: 'done', isError: false } }
    useBackgroundStore.setState({ sessions: { [sessionId]: view } })
    expect(render(completed)).toBe('')

    const observed = structuredClone(view.state)
    const record = Object.values(observed.calls)[0]
    record.backgroundObserved = true
    useBackgroundStore.setState({ sessions: { [sessionId]: { ...view, state: observed } } })
    expect(render(call('visible-id'))).toBe('')

    seed(runningShellState('visible-id'), 'work')
    expect(render(call('visible-id'))).toBe('')
  })

  it('wires the action into an expanded transcript ToolCard but never into a detail body', () => {
    seed(runningShellState('detail-id'))
    harness.slots = []
    renderToolCard(call('detail-id'))
    const row = harness.nodes.find(
      (item) =>
        item.type === 'div' && item.props.role === 'button' && item.props['aria-expanded'] === false
    )
    expect(row).toBeDefined()
    ;(row!.props.onClick as () => void)()
    expect(renderToolCard(call('detail-id'))).toContain('백그라운드 전환')

    harness.slots = []
    expect(renderToolCard(call('detail-id'), 'detail-body')).not.toContain('백그라운드 전환')
  })
  it.each(['completed', 'failed', 'stopped', 'killed'])(
    'hides the action when the task is %s before the tool result arrives',
    (status) => {
      let state = runningShellState('terminal-first')
      const task = Object.values(state.tasks)[0]
      state = applyBackgroundEvent(state, {
        type: 'background.task',
        sessionId,
        taskId: task.taskId,
        toolUseId: 'terminal-first',
        phase: 'notification',
        source: { generation, sequence: 99, receivedAt: Date.now(), replay: false },
        patch: { status }
      })
      seed(state)
      expect(Object.values(state.calls)[0].phase).not.toBe('returned')
      expect(render(call('terminal-first'))).toBe('')
      expect(buttons()).toHaveLength(0)
    }
  )
})
