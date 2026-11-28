import { createElement, type ComponentProps } from 'react'
import type { StateCreator } from 'zustand/vanilla'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installFakeDom, type FakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { OpenCodeToolCard } from '../../harnesses/opencode/transcript/ToolCard'
import { AgentTaskBody } from '../../harnesses/claude/transcript/tool-bodies/AgentTaskBody'
import { AgentTaskRow } from '../../harnesses/common/transcript/AgentTaskRow'
import { SubagentNoticeRow } from '../../harnesses/common/transcript/SubagentNoticeRow'
import { RightPanelTile } from '../../harnesses/common/rightpanel/RightPanelTile'
import { harnessRightPanel } from '../../harnesses/registries/rightpanel'
import { TaskPanelContent } from '../../harnesses/common/rightpanel/TaskPanelContent'
import { PanelNavigationContext } from '../../harnesses/common/rightpanel/panelNavigation'
import { TaskProgressList } from '../../harnesses/common/rightpanel/TaskProgressList'
import { agentUiPolicy } from '../../lib/agentPresentation'
import type { TaskBoardItem } from '../../lib/taskBoard'
import { chatActions, useChatStore } from '../../store/chatStore'
import { panelActions, useRightPanelStore } from '../../store/rightPanelStore'
import { RightPanelFrame } from './RightPanelFrame'
import { GitRow } from '../composer/GitRow'
import type { ChatState } from '../../reducer/chatReducer'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => 'panel-entry',
  useEffectEvent: (callback: (...args: unknown[]) => unknown) => callback,
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('zustand', async (original) => {
  const actual = await original<typeof import('zustand')>()
  const { fakeHooks } = await import('../../../../shared/ui/renderHarness.testfixture')
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
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../../harnesses/common/composer/useGitSnapshot', () => ({ useGitSnapshot: () => {} }))

const settings = vi.hoisted(() => ({ setTweak: vi.fn() }))
vi.mock('../../../../shared/theme/TweakProvider', () => ({
  useTweakContext: () => ({
    t: { open: true, widths: { code: 520, work: 360 } },
    setTweak: settings.setTweak
  })
}))
vi.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))
vi.mock('../../harnesses/registries/rightpanel', async (original) => {
  const actual = await original<typeof import('../../harnesses/registries/rightpanel')>()
  return {
    ...actual,
    harnessRightPanel: (...args: Parameters<typeof actual.harnessRightPanel>) => ({
      ...actual.harnessRightPanel(...args),
      screen: () => null
    })
  }
})
let dom: FakeDom
const original = useChatStore.getInitialState()
const stack = (): ReturnType<typeof useRightPanelStore.getState>['stack'] =>
  useRightPanelStore.getState().stack
const session = (): ChatState => useChatStore.getState().sessions[original.activeKey].session
const overview = { mode: 'plan', children: 'overview' } as const
const item: TaskBoardItem = {
  key: 'agent:one',
  id: 'one',
  title: 'Inspect',
  subject: 'Inspect',
  status: 'in_progress',
  description: 'Read the change',
  blockedBy: []
}
function seed(change: Partial<ChatState> = {}): void {
  const entry = original.sessions[original.activeKey]
  useChatStore.setState({
    ...original,
    sessions: {
      [original.activeKey]: {
        ...entry,
        session: {
          ...entry.session,
          sessionId: 'active',
          backend: 'claude',
          agentKind: 'code',
          ...change
        }
      }
    }
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  settings.setTweak.mockClear()
  dom = installFakeDom({ innerWidth: 1280, innerHeight: 800 })
  seed()
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  panelActions.switchSession({ key: original.activeKey, kind: 'code', backend: 'claude' }, false)
})
afterEach(() => {
  dom.unmount()
  useChatStore.setState(original)
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('toggles the diff stack from the active Git row', () => {
  const state = session()
  seed({
    cwd: '/repo',
    gitStatus: {
      cwd: '/repo',
      status: { isRepo: true, root: '/repo', branch: 'main', detached: false }
    },
    gitSnapshot: {
      ...state.gitSnapshot,
      summary: {
        isRepo: true,
        base: { kind: 'head', oid: 'a'.repeat(40) },
        files: [],
        totals: { added: 2, removed: 1 },
        filesTruncated: false,
        commits: [],
        commitsTruncated: false,
        commitFilesUnavailable: false
      }
    }
  })
  dom.render(createElement(GitRow, { cwd: '/repo', sessionStarted: true }))
  dom.click(dom.query('[data-git-row-diff]')!)
  expect(stack()).toMatchObject([{ kind: 'tile', id: 'diff' }])
  dom.click(dom.query('[data-git-row-diff]')!)
  expect(stack()).toEqual([])
})

it.each(['agent body', 'agent row', 'completion notice', 'OpenCode tool card'] as const)(
  'AC15 pushes a detail over plan from the %s',
  (source) => {
    const call = { toolUseId: 'inspect-1', name: 'Agent', input: { description: 'inspect' } }
    const transcriptPolicy = agentUiPolicy('code').transcript
    if (source === 'OpenCode tool card') {
      seed({ backend: 'opencode' })
      panelActions.switchSession(
        { key: original.activeKey, kind: 'code', backend: 'opencode' },
        false
      )
    }
    panelActions.navigate({ kind: 'tile', id: 'plan' })
    if (source === 'OpenCode tool card')
      dom.render(createElement(OpenCodeToolCard, { call: { ...call, name: 'Task' } }))
    else if (source === 'agent body')
      dom.render(createElement(AgentTaskBody, { call, transcriptPolicy }))
    else if (source === 'agent row')
      dom.render(createElement(AgentTaskRow, { call, transcriptPolicy }))
    else
      dom.render(
        createElement(SubagentNoticeRow, {
          toolRunId: call.toolUseId,
          status: 'completed',
          transcriptPolicy
        })
      )
    const trigger =
      source === 'OpenCode tool card'
        ? dom.query('[data-slot="collapsible-trigger"]')
        : source === 'agent body'
          ? dom.query('[type="button"]')
          : dom.query('[role="button"]')
    expect(trigger).not.toBeNull()
    dom.click(trigger!)
    expect(stack()).toMatchObject([
      { kind: 'tile', id: 'plan' },
      { kind: 'detail', selection: { id: 'subagent', selectedId: call.toolUseId }, origin: trigger }
    ])
  }
)

it.each(['agent row', 'completion notice'] as const)(
  'AC15 keeps the keyboard origin of the %s on the detail layer',
  (source) => {
    const transcriptPolicy = agentUiPolicy('code').transcript
    const call = { toolUseId: 'inspect-1', name: 'Agent', input: { description: 'inspect' } }
    panelActions.navigate({ kind: 'tile', id: 'plan' })
    dom.render(
      source === 'agent row'
        ? createElement(AgentTaskRow, { call, transcriptPolicy })
        : createElement(SubagentNoticeRow, {
            toolRunId: call.toolUseId,
            status: 'completed',
            transcriptPolicy
          })
    )
    const trigger = dom.query('[role="button"]')!
    dom.act(() => trigger.focus())
    dom.key('Enter')
    expect(stack()).toMatchObject([
      { kind: 'tile', id: 'plan' },
      { kind: 'detail', selection: { id: 'subagent', selectedId: call.toolUseId }, origin: trigger }
    ])
  }
)

it('pushes the selected progress item above its plan tile', () => {
  dom.render(createElement(TaskProgressList, { items: [item] }))
  const trigger = dom.query('[data-task-detail-trigger="agent:one"]')!
  dom.click(trigger)
  expect(stack()).toMatchObject([
    { kind: 'tile', id: 'plan' },
    { kind: 'taskDetail', id: 'plan', task: item.key, origin: trigger }
  ])
})
it('pops a disappeared task detail after the resumed list has finished loading', () => {
  chatActions.selectTask(item.key)
  seed({ ...session(), loadingSession: true })
  dom.render(createElement(TaskPanelContent, { ...overview, items: [] }))
  expect(session().selectedTaskKey).toBe(item.key)
  expect(stack().at(-1)).toMatchObject({ kind: 'taskDetail', task: item.key })
  dom.act(() => seed({ ...session(), loadingSession: false }))
  expect(session().selectedTaskKey).toBeNull()
  expect(stack()).toMatchObject([{ kind: 'tile', id: 'plan' }])
})
it('returns to the overview from the standalone task detail back button', () => {
  chatActions.selectTask(item.key)
  dom.render(createElement(TaskPanelContent, { ...overview, items: [item] }))
  const trigger = dom.query('[data-behavior="action:back-to-plan-overview"]')!
  dom.click(trigger)
  expect(session().selectedTaskKey).toBeNull()
  expect(stack()).toMatchObject([{ kind: 'tile', id: 'plan' }])
})

// EP-11 A `TaskPanelContent.tsx:104` — 프레임 안(nav 있음)에서는 자체 뒤로가 없다(뒤로는 프레임 하나).
it('AC15 renders no own back button for a task detail inside the panel frame', () => {
  chatActions.selectTask(item.key)
  const nav = {
    layer: { kind: 'taskDetail' as const, id: 'plan' as const, task: item.key },
    active: true,
    canGoBack: true,
    back: () => {},
    close: () => {}
  }
  dom.render(
    createElement(
      PanelNavigationContext.Provider,
      { value: nav },
      createElement(TaskPanelContent, { ...overview, items: [item] })
    )
  )
  expect(dom.body.textContent).toContain('Read the change')
  expect(dom.query('[data-behavior="action:back-to-plan-overview"]')).toBeNull()
})

it('closes the diff tile from its own close button', () => {
  panelActions.navigate({ kind: 'tile', id: 'diff' })
  const tile: ComponentProps<typeof RightPanelTile> = {
    configuration: harnessRightPanel('claude').configuration,
    id: 'diff',
    defaultLabelKey: 'chat.rightpanel.tiles.diff',
    taskTileChrome: 'standard',
    children: 'diff'
  }
  dom.render(createElement(RightPanelTile, tile))
  dom.click(dom.query('[data-panel-close]')!)
  expect(stack()).toEqual([])
})

it('persists the final frame width from the pointer release in the active mode', () => {
  dom.render(createElement(RightPanelFrame))
  const handle = dom.query('[role="separator"]')!
  const win = new EventTarget()
  const target = {
    ownerDocument: {
      defaultView: win,
      body: { append: vi.fn() },
      createElement: () => ({ setAttribute: vi.fn(), remove: vi.fn() })
    },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true
  }
  dom.act(() => {
    ;(handle.props.onPointerDown as (event: object) => void)({
      currentTarget: target,
      isPrimary: true,
      button: 0,
      clientX: 680,
      pointerId: 1,
      preventDefault: vi.fn()
    })
  })
  for (const [type, x] of [
    ['pointermove', 600],
    ['pointerup', 600]
  ] as const) {
    const e = Object.assign(new Event(type), { pointerId: 1, clientX: x })
    dom.act(() => {
      win.dispatchEvent(e)
    })
  }
  expect(settings.setTweak).toHaveBeenCalledWith('rightPanelWidths', { code: 600, work: 360 })
})
