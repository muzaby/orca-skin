import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanonicalBackgroundContent } from './CanonicalBackgroundContent'
import { SubAgentTileHeader } from './SubAgentTileContent'
import { useBackgroundStore } from '../../store/backgroundStore'
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
  useBackgroundStore.setState({ sessions: backgrounds })
}

function render(header = false): string {
  harness.nodes = []
  // React SSR reads the store's initial snapshot; synchronize it between interactions.
  backgroundInitial.sessions = useBackgroundStore.getState().sessions
  return renderToStaticMarkup(
    createElement(header ? SubAgentTileHeader : CanonicalBackgroundContent)
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
  useBackgroundStore.setState({ sessions: savedBackgrounds })
  vi.restoreAllMocks()
})

describe('canonical background production callbacks', () => {
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

  it('exposes outputs when an opened shell call later gains a task', () => {
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
    expect(render()).toContain('data-background-output="output-1"')
  })
})
