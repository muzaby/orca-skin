import { createElement } from 'react'
import type { StateCreator } from 'zustand/vanilla'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  applyBackgroundEvent,
  backgroundKey,
  emptyBackgroundState,
  type BackgroundEventSource,
  type BackgroundSessionState
} from '../../../../../../shared/background-task'
import {
  FakeNode,
  installFakeDom,
  type FakeDom
} from '../../../../shared/ui/renderHarness.testfixture'
import { AgentTaskBody } from '../../harnesses/claude/transcript/tool-bodies/AgentTaskBody'
import { agentUiPolicy } from '../../lib/agentPresentation'
import { layerKey } from '../../lib/rightPanelStack'
import { transcriptIndexFor } from '../../lib/transcriptIndex'
import { dismissCompletedBackgroundItems, useBackgroundStore } from '../../store/backgroundStore'
import { useChatStore } from '../../store/chatStore'
import { panelActions, useRightPanelStore } from '../../store/rightPanelStore'
import { RightPanelFrame } from './RightPanelFrame'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useId: () => 'ac15-card',
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
vi.mock('../../../../shared/i18n', async (original) => ({
  ...(await original<typeof import('../../../../shared/i18n')>()),
  useI18n: () => ({ tr: (key: string) => key, locale: 'en' })
}))
const ui = vi.hoisted(() => ({ open: true }))
vi.mock('../../../../shared/theme/TweakProvider', () => ({
  useOptionalTweak: () => ({ transcriptTextSize: 'medium', appFont: 'sans' }),
  useTweakContext: () => ({
    t: { open: ui.open, widths: { code: 520, work: 360 } },
    setTweak: (key: string, value: boolean) => {
      if (key === 'rightPanelOpen') ui.open = value
    }
  })
}))
vi.mock('../../../../shared/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }))

type Model = 'canonical' | 'legacy' | 'opencode'
const models: Model[] = ['canonical', 'legacy', 'opencode']
const sessionId = 'background-session'
const generation = 'generation-1'
const initial = useChatStore.getInitialState()
let dom: FakeDom

function canonicalState(includeTask: boolean): BackgroundSessionState {
  const source = (sequence: number): BackgroundEventSource => ({
    generation,
    sequence,
    receivedAt: sequence,
    replay: false
  })
  const state = applyBackgroundEvent(emptyBackgroundState(), {
    type: 'background.call',
    sessionId,
    toolUseId: 'standalone',
    toolName: 'Agent',
    phase: 'started',
    source: source(1),
    input: { description: 'Standalone call' },
    patch: { mode: 'background' }
  })
  if (!includeTask) return state
  const linked = applyBackgroundEvent(state, {
    type: 'background.call',
    sessionId,
    toolUseId: 'call-one',
    toolName: 'Agent',
    phase: 'started',
    source: source(2),
    input: { description: 'Linked call' },
    patch: { mode: 'background' }
  })
  return applyBackgroundEvent(linked, {
    type: 'background.task',
    sessionId,
    taskId: 'task-one',
    toolUseId: 'call-one',
    phase: 'started',
    source: source(3),
    patch: { status: 'running', description: 'First job' }
  })
}

function mount(
  model: Model,
  start: 'plan' | 'subagent' | 'closed' | 'remembered' | 'task' = 'subagent'
): void {
  const base = initial.sessions[initial.activeKey]
  const backend = model === 'opencode' ? 'opencode' : 'claude'
  const toolName = model === 'opencode' ? 'Task' : 'Agent'
  useChatStore.setState({
    activeKey: sessionId,
    sessions: {
      [sessionId]: {
        ...base,
        session: {
          ...base.session,
          sessionId,
          backend,
          agentKind: 'code',
          selectedSubagentTaskId: 'stale-selection',
          messages: [
            {
              id: 'assistant-message',
              role: 'assistant',
              createdAt: 1,
              parts: [
                {
                  type: 'tool_call',
                  toolRunId: 'call-one',
                  toolName,
                  args: { description: 'First job', prompt: 'Prompt one' }
                },
                {
                  type: 'tool_result',
                  toolRunId: 'call-one',
                  isError: false,
                  result: 'Completed first'
                },
                {
                  type: 'tool_call',
                  toolRunId: 'call-two',
                  toolName,
                  args: { description: 'Second job', prompt: 'Prompt two' }
                }
              ]
            }
          ]
        }
      }
    }
  })
  if (model === 'canonical')
    useBackgroundStore.setState({
      sessions: { [sessionId]: { state: canonicalState(true), loading: false } }
    })
  panelActions.switchSession({ key: sessionId, kind: 'code', backend }, false)
  if (start !== 'closed') panelActions.tile(start === 'remembered' ? 'subagent' : start)
  if (start === 'remembered') panelActions.close()
  ui.open = start !== 'closed' && start !== 'remembered'
  dom.render(
    createElement(
      'div',
      { 'data-side-pane-host': '' },
      createElement(
        'div',
        { 'data-transcript-card': '' },
        createElement(AgentTaskBody, {
          call: { toolUseId: 'call-one', name: 'Agent', input: { description: 'First job' } },
          transcriptPolicy: agentUiPolicy('code').transcript
        })
      ),
      createElement(
        'button',
        { type: 'button', 'data-menu-entry': '', onClick: () => panelActions.tile('subagent') },
        'Agents'
      ),
      createElement(RightPanelFrame)
    )
  )
}

function activeLayer(): FakeNode {
  return dom.queryAll('[data-right-panel-layer]').find((node) => !node.props.inert)!
}
function header(): FakeNode {
  return activeLayer().querySelector('[data-context]')!.children[0]
}
function expectBackCount(count: number): void {
  const buttons = header()
    .querySelectorAll('[aria-label]')
    .filter((node) =>
      ['header.back', 'chat.subagentTile.backToList'].includes(String(node.props['aria-label']))
    )
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(
    count ? ['header.back'] : []
  )
  expect(header().querySelectorAll('[aria-label="chat.subagentTile.backToList"]')).toHaveLength(0)
  expect(header().querySelectorAll('[data-panel-back]')).toHaveLength(count)
}
function stack(): string[] {
  return useRightPanelStore.getState().stack.map(layerKey)
}
function row(model: Model): FakeNode {
  if (model === 'canonical')
    return activeLayer().querySelector('[data-background-task="task-one"]')!
  return activeLayer()
    .querySelectorAll(model === 'opencode' ? '[type="button"]' : '[role="button"]')
    .find((node) => node.textContent.includes('First job'))!
}
function back(): void {
  dom.click(header().querySelector('[data-panel-back]')!)
}
function card(): FakeNode {
  return dom.query('[data-transcript-card]')!.querySelector('[type="button"]')!
}

beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({
    innerWidth: 1600,
    innerHeight: 900,
    layout: () => ({ rect: { left: 0, top: 0, width: 1500, height: 600 } })
  })
  vi.stubGlobal('HTMLElement', FakeNode)
  vi.stubGlobal('getComputedStyle', () => ({ lineHeight: '20px' }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
  useRightPanelStore.setState(useRightPanelStore.getInitialState(), true)
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true)
})
afterEach(() => {
  dom.unmount()
  useChatStore.setState(initial, true)
  useBackgroundStore.setState(useBackgroundStore.getInitialState(), true)
  useRightPanelStore.setState(useRightPanelStore.getInitialState(), true)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each(models)(
  'AC15 shows one back button at depth two for each background header: %s',
  (model) => {
    mount(model)
    expect(stack()).toEqual(['subagent'])
    expectBackCount(0)
    const origin = row(model)
    dom.click(origin)
    expect(stack()).toEqual(['subagent', 'detail:subagent'])
    expect(header().textContent).toContain('First job')
    expectBackCount(1)
    back()
    expect(stack()).toEqual(['subagent'])
    expect(dom.activeElement).toBe(row(model))
    expectBackCount(0)
  }
)

it.each(models)('AC15 pushes a detail from each list: %s', (model) => {
  mount(model)
  const origin = row(model)
  dom.click(origin)
  const detail = useRightPanelStore.getState().stack.at(-1)
  expect(stack()).toEqual(['subagent', 'detail:subagent'])
  expect(detail).toMatchObject({
    kind: 'detail',
    selection:
      model === 'canonical'
        ? {
            id: 'subagent',
            selectedId: backgroundKey(generation, 'task-one'),
            backgroundKind: 'task'
          }
        : { id: 'subagent', selectedId: 'call-one' }
  })
  expect(detail?.origin).toBe(origin)
})

it('AC15 pushes a detail from each list: canonical standalone call', () => {
  mount('canonical')
  const origin = activeLayer().querySelector('[data-background-call="standalone"]')!
  dom.click(origin)
  const detail = useRightPanelStore.getState().stack.at(-1)
  expect(stack()).toEqual(['subagent', 'detail:subagent'])
  expect(detail).toMatchObject({
    kind: 'detail',
    selection: {
      id: 'subagent',
      selectedId: backgroundKey(generation, 'standalone'),
      backgroundKind: 'call'
    }
  })
  expect(detail?.origin).toBe(origin)
  expect(activeLayer().querySelector('[data-background-call-detail="standalone"]')).not.toBeNull()
  back()
  expect(dom.activeElement).toBe(origin)
})

it.each([
  ['plan', 'plan'],
  ['closed', 'plan'],
  ['remembered', 'subagent']
] as const)('AC15 walks back in entry order from a transcript card: %s', (start, underlay) => {
  mount('legacy', start)
  const origin = card()
  dom.click(origin)
  expect(stack()).toEqual([underlay, 'detail:subagent'])
  expectBackCount(1)
  dom.key('Escape')
  expect(stack()).toEqual([underlay])
  expect(dom.activeElement).toBe(origin)
  expectBackCount(0)
})

it('AC15 walks back in entry order from plan through the background list', () => {
  mount('legacy', 'plan')
  const menu = dom.query('[data-menu-entry]')!
  dom.click(menu)
  expect(stack()).toEqual(['plan', 'subagent'])
  expectBackCount(1)
  dom.click(row('legacy'))
  expect(stack()).toEqual(['plan', 'subagent', 'detail:subagent'])
  expectBackCount(1)
  back()
  expect(stack()).toEqual(['plan', 'subagent'])
  expect(dom.activeElement).toBe(row('legacy'))
  expectBackCount(1)
  dom.key('Escape')
  expect(stack()).toEqual(['plan'])
  expect(dom.activeElement).toBe(menu)
  expectBackCount(0)
})

it.each(['task', 'call'] as const)(
  'AC15 reads the selection from the detail layer: canonical %s',
  (backgroundKind) => {
    mount('canonical')
    const task = backgroundKind === 'task'
    const id = task ? 'task-one' : 'standalone'
    dom.act(() =>
      panelActions.navigate({
        kind: 'detail',
        selection: { id: 'subagent', backgroundKind, selectedId: backgroundKey(generation, id) }
      })
    )
    expect(header().textContent).toContain(task ? 'First job' : 'Standalone call')
    expect(
      activeLayer().querySelector(
        `[${task ? 'data-background-detail' : 'data-background-call-detail'}="${id}"]`
      )
    ).not.toBeNull()
  }
)

it.each(['legacy', 'opencode'] as const)(
  'AC15 reads the selection from the detail layer: %s',
  (model) => {
    mount(model)
    for (const [id, title, prompt] of [
      ['call-one', 'First job', 'Prompt one'],
      ['call-two', 'Second job', 'Prompt two']
    ]) {
      dom.act(() =>
        panelActions.navigate({ kind: 'detail', selection: { id: 'subagent', selectedId: id } })
      )
      expect(stack()).toEqual(['subagent', 'detail:subagent'])
      expect(header().textContent).toContain(title)
      expect(activeLayer().textContent).toContain(prompt)
      expectBackCount(1)
    }
    back()
    expect(stack()).toEqual(['subagent'])
  }
)

it.each(['legacy', 'canonical'] as const)(
  'AC15 pops a disappeared background detail: %s',
  (model) => {
    mount(model)
    dom.click(row(model))
    expect(stack()).toEqual(['subagent', 'detail:subagent'])
    dom.act(() => {
      if (model === 'canonical') {
        useBackgroundStore.setState({
          sessions: { [sessionId]: { state: canonicalState(false), loading: false } }
        })
      } else {
        const { session } = useChatStore.getState().sessions[sessionId]
        dismissCompletedBackgroundItems(sessionId, transcriptIndexFor(session).subagentTasks(false))
      }
    })
    expect(stack()).toEqual(['subagent'])
    expectBackCount(0)
    expect(row(model)).toBeFalsy()
    expect(activeLayer().textContent).toContain(
      model === 'canonical' ? 'Standalone call' : 'Second job'
    )
  }
)

it('AC15 walks back in entry order from the OpenCode overview through its agent list', () => {
  mount('opencode', 'task')
  const group = activeLayer().querySelector('[data-panel-group="agents"]')!
  const listEntry = group.querySelector('[type="button"]')!
  dom.click(listEntry)
  expect(stack()).toEqual(['task', 'detail:subagent-list'])
  dom.click(row('opencode'))
  expect(stack()).toEqual(['task', 'detail:subagent-list', 'detail:subagent'])
  expectBackCount(1)
  dom.key('Escape')
  expect(stack()).toEqual(['task', 'detail:subagent-list'])
  expect(dom.activeElement).toBe(row('opencode'))
  back()
  expect(stack()).toEqual(['task'])
  expect(dom.activeElement).toBe(listEntry)
})

it('AC15 pops a disappeared background detail when the canonical feed becomes empty', () => {
  mount('canonical')
  dom.click(row('canonical'))
  expect(stack()).toEqual(['subagent', 'detail:subagent'])
  dom.act(() => useBackgroundStore.setState({ sessions: {} }))
  expect(stack()).toEqual(['subagent'])
  expectBackCount(0)
  expect(row('legacy')?.textContent).toContain('First job')
})

// EP-11 B `chatStore.ts` openSubagentTask — 정본 호출이 있으면 호출 키와 종류를, OpenCode 는 도구 ID 를 층에 싣는다.
it('AC15 opens the canonical call of a transcript card as a call detail', () => {
  mount('canonical', 'plan')
  const origin = card()
  dom.click(origin)
  expect(stack()).toEqual(['plan', 'detail:subagent'])
  expect(useRightPanelStore.getState().stack.at(-1)).toMatchObject({
    kind: 'detail',
    selection: {
      id: 'subagent',
      selectedId: backgroundKey(generation, 'call-one'),
      backgroundKind: 'call'
    }
  })
  expect(header().textContent).not.toContain('chat.subagentTile.headerTitle')
  expectBackCount(1)
})

it('AC15 keeps the OpenCode tool id when the session also has background records', () => {
  mount('opencode', 'plan')
  dom.act(() =>
    useBackgroundStore.setState({
      sessions: { [sessionId]: { state: canonicalState(true), loading: false } }
    })
  )
  dom.click(card())
  expect(stack()).toEqual(['plan', 'detail:subagent'])
  expect(
    useRightPanelStore.getState().stack.at(-1)?.kind === 'detail' &&
      useRightPanelStore.getState().stack.at(-1)
  ).toMatchObject({
    selection: { id: 'subagent', selectedId: 'call-one' }
  })
  expect(
    (useRightPanelStore.getState().stack.at(-1) as { selection: { backgroundKind?: string } })
      .selection.backgroundKind
  ).toBeUndefined()
  expect(header().textContent).toContain('First job')
})

// EP-11 B 사라진 항목 pop — 세 머리 모두(AC15 표 마지막 행).
it('AC15 pops a disappeared background detail: opencode', () => {
  mount('opencode')
  dom.click(row('opencode'))
  expect(stack()).toEqual(['subagent', 'detail:subagent'])
  dom.act(() =>
    useChatStore.setState((state) => {
      const entry = state.sessions[sessionId]
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...entry,
            session: {
              ...entry.session,
              messages: entry.session.messages.map((message) => ({
                ...message,
                parts: message.parts.filter(
                  (part) =>
                    !('toolRunId' in part) ||
                    (part as { toolRunId: string }).toolRunId !== 'call-one'
                )
              }))
            }
          }
        }
      }
    })
  )
  expect(stack()).toEqual(['subagent'])
  expectBackCount(0)
})

// EP-11 A `RightPanelTile.tsx:62` 개요 머리 — 깊이 2에서 패널 뒤로 1개(기존 규칙, ΔV4 입력).
it('AC15 shows one back button on the overview header at depth two', () => {
  mount('opencode', 'subagent')
  dom.act(() => panelActions.tile('task'))
  expect(stack()).toEqual(['subagent', 'task'])
  expectBackCount(1)
  back()
  expect(stack()).toEqual(['subagent'])
  expectBackCount(0)
})
