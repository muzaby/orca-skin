import { createElement } from 'react'
import type { StateCreator } from 'zustand/vanilla'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  FakeNode,
  installFakeDom,
  type FakeDom
} from '../../../../../shared/ui/renderHarness.testfixture'
import { RightPanelFrame } from '../../../components/rightpanel/RightPanelFrame'
import type { ChatState } from '../../../reducer/chatReducer'
import { useChatStore } from '../../../store/chatStore'
import { panelActions, useRightPanelStore } from '../../../store/rightPanelStore'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffectEvent: (callback: (...args: unknown[]) => unknown) => callback,
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// Bind the real Zustand stores to the render harness. Navigation and chat actions run normally.
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../../../shared/ui/renderHarness.testfixture')
  const create = (initializer?: StateCreator<unknown>): unknown => {
    if (!initializer) return create
    const store = actual.createStore(initializer)
    return Object.assign(
      (selector: (state: unknown) => unknown = (state) => state) =>
        fakeHooks.useSyncExternalStore(store.subscribe, () => selector(store.getState())),
      store
    )
  }
  return { ...actual, create }
})
vi.mock('../../../../../shared/i18n', async (original) => {
  const actual = await original<typeof import('../../../../../shared/i18n')>()
  return { ...actual, useI18n: () => ({ tr: actual.i18n.t, locale: 'ko' }) }
})
const settings = vi.hoisted(() => ({ open: true }))
vi.mock('../../../../../shared/theme/TweakProvider', () => ({
  useTweakContext: () => ({
    t: { open: settings.open, widths: { code: 520, work: 360 } },
    setTweak: (key: string, value: boolean) => {
      if (key === 'rightPanelOpen') settings.open = value
    }
  })
}))
vi.mock('../../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))

const initial = useChatStore.getState()
let dom: FakeDom
const session = (): ChatState => useChatStore.getState().sessions[initial.activeKey].session
const layer = (id: string): FakeNode => dom.query(`[data-right-panel-layer="${id}"]`)!

function clickNamedButton(root: FakeNode, text: string): void {
  function find(node: FakeNode): FakeNode | undefined {
    if (node.tag === 'button' && node.textContent.includes(text)) return node
    for (const child of node.children) {
      const button = find(child)
      if (button) return button
    }
    return undefined
  }
  const button = find(root)
  expect(button, text).toBeDefined()
  dom.click(button!)
}

beforeEach(() => {
  settings.open = true
  vi.useFakeTimers()
  dom = installFakeDom({
    innerWidth: 1600,
    innerHeight: 900,
    layout: () => ({ rect: { left: 0, top: 0, width: 1500, height: 600 } })
  })
  vi.stubGlobal('HTMLElement', FakeNode)
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
  const entry = initial.sessions[initial.activeKey]
  useChatStore.setState({
    ...initial,
    sessions: {
      ...initial.sessions,
      [initial.activeKey]: {
        ...entry,
        session: {
          ...entry.session,
          backend: 'opencode',
          sessionId: 'native-entries',
          agentKind: 'code',
          messages: [
            {
              id: 'assistant-tools',
              role: 'assistant',
              createdAt: 1,
              parts: [
                {
                  type: 'tool_call',
                  toolRunId: 'agent-a',
                  toolName: 'Task',
                  args: { description: 'Inspect package' }
                },
                {
                  type: 'tool_call',
                  toolRunId: 'agent-b',
                  toolName: 'Task',
                  args: { description: 'Inspect licenses', prompt: 'Check license text' }
                },
                {
                  type: 'tool_call',
                  toolRunId: 'shell-a',
                  toolName: 'Bash',
                  args: { command: 'echo package' }
                },
                {
                  type: 'tool_call',
                  toolRunId: 'shell-b',
                  toolName: 'Bash',
                  args: { command: 'echo licenses' }
                }
              ]
            }
          ]
        }
      }
    }
  })
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  dom.render(createElement(RightPanelFrame))
})
afterEach(() => {
  dom.unmount()
  useChatStore.setState(initial)
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('selects the clicked agent from the native subagent tile', () => {
  dom.act(() => panelActions.tile('subagent'))
  clickNamedButton(layer('subagent'), 'Inspect licenses')
  expect(useRightPanelStore.getState().stack).toMatchObject([
    { kind: 'tile', id: 'task' },
    { kind: 'tile', id: 'subagent' },
    { kind: 'detail', selection: { id: 'subagent', selectedId: 'agent-b' } }
  ])
  expect(layer('detail:subagent').textContent).toContain('Check license text')
})

it('selects the clicked command from the native process tile', () => {
  dom.act(() => panelActions.tile('process'))
  clickNamedButton(layer('process'), 'echo licenses')
  expect(session().selectedProcessToolId).toBe('shell-b')
  expect(useRightPanelStore.getState().stack.at(-1)).toMatchObject({ kind: 'tile', id: 'process' })
  expect(layer('process').textContent).toContain('$ echo licenses')
  expect(
    layer('process').querySelector('[data-component="opencode-process-output"]')
  ).not.toBeNull()
})

it('closes the whole panel from the OpenCode detail close button', () => {
  const group = layer('task').querySelector('[data-panel-group="processes"]')!
  clickNamedButton(group, 'echo licenses')
  expect(useRightPanelStore.getState().stack).toMatchObject([
    { kind: 'tile', id: 'task' },
    { kind: 'detail', selection: { id: 'process', selectedId: 'shell-b' } }
  ])
  dom.click(layer('detail:process').querySelector('[data-panel-close]')!)
  expect(useRightPanelStore.getState().stack).toEqual([])
  expect(settings.open).toBe(false)
  expect(dom.query('[data-right-panel-layer]')).toBeNull()
})
