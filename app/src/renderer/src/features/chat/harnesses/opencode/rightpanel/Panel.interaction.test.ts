import { createElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { chatActions, useChatStore } from '../../../store/chatStore'
import { OpenCodeToolCard } from '../transcript/ToolCard'
import { OpenCodeRightPanel } from './Panel'
import type { TilePanelDetail } from '../../common/rightpanel/TilePanel'
import type { OpenCodePanelNavigation } from './navigation'
import { deriveRightPanelLayout, rightPanelColumnsForAgent } from '../../../lib/rightPanelLayout'
import { rightPanelPolicy } from '../../../lib/rightPanelTiles'
import { harnessRightPanel } from '../../registries/rightpanel'

const captured = vi.hoisted(() => ({ detail: undefined as TilePanelDetail | undefined }))
vi.mock('./navigation', async (original) => ({
  ...(await original<typeof import('./navigation')>()),
  OpenCodePanelNavigationContext: { Provider: ({ children }: { children?: ReactNode }) => children }
}))
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
// Host DOM/focus/visibility behavior is separately exercised by TilePanel.detail.test.ts.
vi.mock('../../common/rightpanel/TilePanel', () => ({
  TilePanel: (props: { detail?: TilePanelDetail }) => {
    captured.detail = props.detail
    return null
  }
}))
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
        panelReveal: undefined,
        session: {
          ...entry.session,
          backend: 'opencode',
          agentKind: 'code',
          rightPanelTiles: [{ id: 'task', tiles: ['task'] }],
          rightPanelColWidths: [420]
        }
      }
    }
  })
  captured.detail = undefined
})
afterEach(() => {
  dom.unmount()
  useChatStore.setState(initial)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function render(): void {
  const state = useChatStore.getState()
  const session = state.sessions[state.activeKey].session
  dom.render(
    createElement(
      'div',
      null,
      createElement(OpenCodeToolCard, {
        call: { toolUseId: 'task-1', name: 'Task', input: { description: 'Inspect' } }
      }),
      createElement(OpenCodeRightPanel, {
        configuration: harnessRightPanel('opencode').configuration,
        panelPolicy: rightPanelPolicy('code', 'opencode'),
        layout: deriveRightPanelLayout(
          rightPanelColumnsForAgent(session.rightPanelTiles, 'code', 'opencode')
        )
      })
    )
  )
}

describe('OpenCode task card to detail host', () => {
  it('opens one overlay with the selected task and parent width, resizes the parent, then closes without adding tiles', () => {
    render()
    expect(captured.detail).toBeUndefined()
    const nodes = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(nodes)]
    const pill = nodes(dom.body).find((node) => node.tag === 'button')!
    dom.click(pill)
    render()
    expect(captured.detail).toBeDefined()
    const detail = captured.detail!
    const context = detail.content as ReactElement<{ value: OpenCodePanelNavigation }>
    expect(context.props.value.selection).toEqual({ id: 'subagent', selectedId: 'task-1' })
    expect(detail.origin).toBe(pill)
    expect(detail.width).toBe(428)
    const session = (): ReturnType<typeof useChatStore.getState>['sessions'][string]['session'] => {
      const state = useChatStore.getState()
      return state.sessions[state.activeKey].session
    }
    expect(session().rightPanelTiles).toEqual([{ id: 'task', tiles: ['task'] }])
    dom.act(() => detail.onWidthChange(508))
    render()
    expect(session().rightPanelColWidths[0]).toBe(500)
    expect(captured.detail?.width).toBe(508)
    dom.act(() => captured.detail!.onClose())
    expect(captured.detail).toBeUndefined()
    const closed = useChatStore.getState()
    expect(closed.sessions[closed.activeKey].panelReveal).toBeUndefined()
    // Returning to the cached conversation must not replay a consumed open request.
    dom.render(null)
    render()
    expect(captured.detail).toBeUndefined()
    dom.act(() => chatActions.openSubagentTask('task-2'))
    render()
    expect(captured.detail?.width).toBe(508)
    expect(
      (captured.detail!.content as ReactElement<{ value: OpenCodePanelNavigation }>).props.value
        .selection
    ).toEqual({ id: 'subagent', selectedId: 'task-2' })
    expect(session().rightPanelTiles).toEqual([{ id: 'task', tiles: ['task'] }])
  })
})
