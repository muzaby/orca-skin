import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { chatActions, useChatStore } from '../../../store/chatStore'
import { OpenCodeToolCard } from '../transcript/ToolCard'
import { panelActions, useRightPanelStore } from '../../../store/rightPanelStore'
vi.mock('react', async (original) => {
  const hooks = (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
  return {
    ...(await original<typeof import('react')>()),
    ...hooks,
    useContext: () => null,
    useReducer: (reduce: (state: unknown, action: unknown) => unknown, initial: unknown) => {
      const [state, set] = hooks.useState(initial)
      return [state, (action: unknown) => set((previous: unknown) => reduce(previous, action))]
    }
  }
})
vi.mock('../../../store/chatStore', async (original) => {
  const store = await original<typeof import('../../../store/chatStore')>()
  return {
    ...store,
    useChatStore: Object.assign(
      (selector: (state: ReturnType<typeof store.useChatStore.getState>) => unknown) =>
        selector(store.useChatStore.getState()),
      store.useChatStore
    ),
    useChatSession: (selector: (state: ReturnType<typeof store.useChatSession>) => unknown) => {
      const state = store.useChatStore.getState()
      return selector(state.sessions[state.activeKey].session)
    }
  }
})
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../../hooks/useDiffSyntax', () => ({ useDiffSyntax: () => new Map() }))

let dom: FakeDom
const initial = useChatStore.getState()
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1600, innerHeight: 900 })
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
          agentKind: 'code'
        }
      }
    }
  })
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  panelActions.switchSession({ key: initial.activeKey, kind: 'code', backend: 'opencode' }, true)
})
afterEach(() => {
  dom.unmount()
  useChatStore.setState(initial)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('opens a task card at its detail with the summary beneath and records the focus origin', () => {
  dom.render(
    createElement(OpenCodeToolCard, {
      call: { toolUseId: 'task-1', name: 'Task', input: { description: 'Inspect' } }
    })
  )
  const nodes = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(nodes)]
  const pill = nodes(dom.body).find((node) => node.tag === 'button')!
  dom.click(pill)
  const { stack } = useRightPanelStore.getState()
  expect(stack).toHaveLength(2)
  expect(stack[1]).toMatchObject({
    kind: 'detail',
    selection: { id: 'subagent', selectedId: 'task-1' }
  })
  expect(stack[1].origin).toBe(pill)
  panelActions.back()
  expect(useRightPanelStore.getState().stack).toMatchObject([{ kind: 'tile', id: 'task' }])
  chatActions.openSubagentTask('task-2')
  expect(useRightPanelStore.getState().stack.at(-1)).toMatchObject({
    selection: { selectedId: 'task-2' }
  })
})
