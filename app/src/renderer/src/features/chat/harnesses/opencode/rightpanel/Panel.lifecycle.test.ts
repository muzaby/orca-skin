import { createElement } from 'react'
import type { StateCreator } from 'zustand/vanilla'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { RightPanelFrame } from '../../common/rightpanel/RightPanelFrame'
import { panelActions, useRightPanelStore } from '../../../store/rightPanelStore'
import { useChatStore } from '../../../store/chatStore'
import { useArtifactViewerStore } from '../../../store/artifactViewerStore'
import type { ChatState } from '../../../reducer/chatReducer'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffectEvent: (callback: (...args: unknown[]) => unknown) => callback,
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
// Keep production store initializers/actions/subscriptions; replace only Zustand's React binding.
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
  const module = await original<typeof import('../../../../../shared/i18n')>()
  return { ...module, useI18n: () => ({ tr: module.i18n.t, locale: 'ko' }) }
})

const ui = vi.hoisted(() => ({ open: true, reduced: true }))
vi.mock('../../../../../shared/theme/TweakProvider', () => ({
  useTweakContext: () => ({
    t: { open: ui.open, widths: { code: 520, work: 360 } },
    setTweak: (key: string, value: boolean) => {
      if (key === 'rightPanelOpen') ui.open = value
    }
  })
}))
vi.mock('../../../../../shared/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ui.reduced
}))

let dom: FakeDom
const initial = useChatStore.getState()
const initialArtifacts = useArtifactViewerStore.getState()
const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]
const buttons = (root: FakeNode): FakeNode[] => all(root).filter((node) => node.tag === 'button')
const overview = (): FakeNode => dom.query('[data-component="opencode-session-panel"]')!
const detail = (): FakeNode | null =>
  all(dom.body).find((node) =>
    String(node.props['data-right-panel-layer'] ?? '').startsWith('detail:')
  ) ?? null
const session = (): ChatState => {
  const state = useChatStore.getState()
  return state.sessions[state.activeKey].session
}
function update(change: Partial<ChatState>): void {
  const state = useChatStore.getState()
  useChatStore.setState({
    sessions: {
      ...state.sessions,
      [state.activeKey]: {
        ...state.sessions[state.activeKey],
        session: { ...session(), ...change }
      }
    }
  })
}
function entry(kind: 'diff' | 'subagent' | 'process' | 'source'): FakeNode {
  if (kind === 'diff') return overview().querySelector('[data-panel-focus="changes"]')!
  if (kind === 'source') return overview().querySelector('[data-panel-focus="sources"]')!
  return buttons(
    overview().querySelector(
      `[data-panel-group="${kind === 'subagent' ? 'agents' : 'processes'}"]`
    )!
  )[0]
}
function mount(): void {
  dom.render(
    createElement('div', { 'data-side-pane-host': '' }, createElement(RightPanelFrame, {}))
  )
}
beforeEach(() => {
  ui.open = true
  ui.reduced = true
  vi.useFakeTimers()
  dom = installFakeDom({
    innerWidth: 1600,
    innerHeight: 900,
    layout: () => ({ rect: { left: 0, top: 0, width: 1500, height: 600 } })
  })
  vi.stubGlobal('HTMLElement', FakeNode)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        /* Fixture geometry is fixed throughout each render. */
      }
      disconnect(): void {
        /* No native observer is installed. */
      }
    }
  )
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame)
  vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame)
  useArtifactViewerStore.setState({ ...initialArtifacts, selection: null })
  useChatStore.setState(initial)
  useRightPanelStore.setState(useRightPanelStore.getInitialState())
  update({
    sessionId: 'panel-session',
    backend: 'opencode',
    agentKind: 'code',
    cwd: 'C:/orcinus-orca',
    extraDirs: ['C:/references'],
    selectedSubagentTaskId: 'base-agent',
    messages: [
      {
        id: 'm-110',
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'agent-1',
            toolName: 'Task',
            args: { description: 'Inspect fixture' }
          },
          {
            type: 'tool_call',
            toolRunId: 'shell-1',
            toolName: 'Bash',
            args: { command: 'echo first' }
          },
          {
            type: 'tool_call',
            toolRunId: 'shell-2',
            toolName: 'Bash',
            args: { command: 'echo second' }
          }
        ]
      }
    ]
  })
})
afterEach(() => {
  dom.unmount()
  useChatStore.setState(initial)
  useArtifactViewerStore.setState(initialArtifacts)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('OpenCode summary lifecycle', () => {
  it('AC2 four session switch pairs retain the frame and replace its content layer', () => {
    mount()
    const frame = dom.query('[data-right-panel-frame]')!
    let layer = dom.query('[data-right-panel-layer]')!
    const nextSessions = [
      ['c1', 'code', 'claude'],
      ['c2', 'code', 'claude'],
      ['w', 'work', 'claude'],
      ['o1', 'code', 'opencode'],
      ['o2', 'code', 'opencode']
    ] as const
    for (const [key, agentKind, backend] of nextSessions) {
      const current = useChatStore.getState()
      const old = current.sessions[current.activeKey]
      dom.act(() =>
        useChatStore.setState({
          activeKey: key,
          sessions: {
            ...current.sessions,
            [key]: { ...old, session: { ...old.session, sessionId: key, agentKind, backend } }
          }
        })
      )
      expect(dom.query('[data-right-panel-frame]') === frame).toBe(true)
      const arrival = dom.query('[data-right-panel-layer]')!
      expect(arrival === layer).toBe(false)
      expect(arrival.props.inert).toBe(false)
      expect(frame.props['data-phase']).toBe('open')
      layer = arrival
    }
  })
  it('AC5 retains the inert outgoing content until the 200ms width transition settles', () => {
    ui.reduced = false
    mount()
    const frame = dom.query('[data-right-panel-frame]')!
    const former = dom.query('[data-right-panel-layer]')!
    dom.act(() => panelActions.close())
    expect(frame.props['data-phase']).toBe('closing')
    expect(dom.query('[data-right-panel-layer]') === former).toBe(true)
    expect(former.props.inert).toBe(true)
    dom.act(() => vi.advanceTimersByTime(199))
    expect(dom.query('[data-right-panel-layer]') === former).toBe(true)
    dom.act(() => vi.advanceTimersByTime(1))
    expect(frame.props['data-phase']).toBe('closed')
    expect(dom.query('[data-right-panel-layer]')).toBeNull()
  })
  it('inherits the task column width and restores detail scroll after expansion', () => {
    mount()
    const base = overview()
    dom.click(entry('diff'))
    const pane = dom.query('[data-resizable-side-pane]')!
    const surface = pane.querySelector('[data-side-pane-surface]')!
    expect(dom.query('[data-right-panel-frame]')!.props.style).toMatchObject({ width: 520 })
    pane.scrollTop = 76
    dom.act(() => (pane.props.onScrollCapture as (event: unknown) => void)({ target: pane }))
    dom.click(detail()!.querySelector('[data-diff-expand-panel]')!)
    expect(surface.props['data-side-pane-expanded']).toBe(true)
    expect(pane.querySelector('[data-side-pane-resize]')).toBeNull()
    pane.scrollTop = 0
    dom.click(detail()!.querySelector('[data-diff-expand-panel]')!)
    expect(surface.props['data-side-pane-expanded']).toBeUndefined()
    expect(pane.scrollTop).toBe(76)
    dom.click(detail()!.querySelector('[data-panel-back]')!)
    expect(overview()).toBe(base)
  })
  it.each(['diff', 'subagent', 'process', 'source'] as const)(
    'opens %s from the summary and closes back to the same overview',
    (kind) => {
      mount()
      const base = overview()
      const origin = entry(kind)
      dom.click(origin)
      expect(detail()?.querySelector(`[data-context="${kind}"]`)).not.toBeNull()
      expect(detail()?.props.hidden).toBe(false)
      expect(dom.query('[data-right-panel-layer="task"]')?.props.inert).toBe(true)
      expect(detail()?.querySelectorAll('[data-panel-close]')).toHaveLength(1)
      expect(overview()).toBe(base)
      expect(dom.activeElement).toBe(detail()!.querySelector('[data-panel-back]'))
      dom.click(detail()!.querySelector('[data-panel-back]')!)
      expect(detail()).toBeNull()
      expect(overview()).toBe(base)
      expect(dom.activeElement).toBe(origin)
      dom.click(origin)
      dom.key('Escape')
      expect(detail()).toBeNull()
      expect(dom.activeElement).toBe(origin)
    }
  )

  it('selects an agent inside the overlay without changing the base selection', () => {
    mount()
    dom.click(entry('subagent'))
    dom.click(buttons(detail()!).find((node) => node.textContent.includes('Inspect fixture'))!)
    expect(detail()!.textContent).toContain('Inspect fixture')
    expect(detail()!.textContent).toContain('응답')
    expect(session().selectedSubagentTaskId).toBe('base-agent')
    dom.click(buttons(detail()!).find((node) => node.props['aria-label'] === '목록으로')!)
    expect(detail()!.textContent).toContain('Inspect fixture')
    expect(buttons(detail()!).some((node) => node.props['aria-label'] === '목록으로')).toBe(false)
    expect(buttons(detail()!).some((node) => node.textContent.includes('Inspect fixture'))).toBe(
      true
    )
    expect(session().selectedSubagentTaskId).toBe('base-agent')
  })

  it('updates active processes through store subscriptions while preserving the open final log', () => {
    mount()
    dom.click(entry('process'))
    const result = (
      id: string
    ): Extract<ChatState['messages'][number]['parts'][number], { type: 'tool_result' }> => ({
      type: 'tool_result' as const,
      toolRunId: id,
      result: `${id} final log`,
      isError: false
    })
    dom.act(() =>
      update({
        messages: [
          { ...session().messages[0], parts: [...session().messages[0].parts, result('shell-1')] }
        ]
      })
    )
    expect(overview().querySelector('[data-panel-group="processes"]')!.textContent).not.toContain(
      'echo first'
    )
    expect(overview().querySelector('[data-panel-group="processes"]')!.textContent).toContain(
      'echo second'
    )
    expect(detail()!.querySelector('[data-component="opencode-process-output"]')!.textContent).toBe(
      'shell-1 final log'
    )
    dom.act(() =>
      update({
        messages: [
          { ...session().messages[0], parts: [...session().messages[0].parts, result('shell-2')] }
        ]
      })
    )
    expect(overview().querySelector('[data-panel-group="processes"]')).toBeNull()
    expect(detail()!.textContent).toContain('shell-1 final log')
    dom.click(detail()!.querySelector('[data-panel-back]')!)
    expect(dom.activeElement).toBe(entry('diff'))
    expect(overview().querySelector('[data-panel-group="agents"]')).not.toBeNull()
    expect(overview().querySelector('[data-component="opencode-sources"]')).not.toBeNull()
  })

  it('preserves detail state under an artifact and clears it on session change', () => {
    mount()
    dom.click(entry('process'))
    const layer = detail()!
    const output = layer.querySelector('[data-component="opencode-process-output"]')!
    output.scrollTop = 123
    const key = useChatStore.getState().activeKey
    dom.act(() =>
      useArtifactViewerStore.setState({
        selection: {
          sessionKey: key,
          sessionId: 'panel-session',
          request: 1,
          loading: false,
          mode: 'code',
          expanded: false,
          artifact: {
            publicationId: 'publication',
            artifactFileId: 'file',
            title: 'Output',
            filename: 'out.txt',
            kind: 'text',
            sizeBytes: 6,
            publishedAt: 1
          },
          result: { state: 'ready', format: 'text', content: 'Output', mimeType: 'text/plain' }
        }
      })
    )
    dom.act(() =>
      panelActions.navigate({
        kind: 'artifact',
        viewer: useArtifactViewerStore.getState().selection!
      })
    )
    expect(detail()).toBe(layer)
    expect(layer.props.hidden).toBe(true)
    expect(dom.query('[data-artifact-viewer]')).not.toBeNull()
    const first = useArtifactViewerStore.getState().selection!
    dom.act(() => useArtifactViewerStore.setState({ selection: { ...first, expanded: true } }))
    const second = {
      ...first,
      request: first.request + 1,
      artifact: { ...first.artifact, publicationId: 'second' }
    }
    dom.act(() => {
      useArtifactViewerStore.setState({ selection: second })
      panelActions.navigate({ kind: 'artifact', viewer: second })
    })
    dom.act(() => panelActions.back())
    expect(useArtifactViewerStore.getState().selection).toMatchObject({
      request: first.request,
      expanded: true
    })
    // A retry that can no longer read the file dismisses its layer, restoring its origin.
    dom.act(() => useArtifactViewerStore.setState({ selection: null }))
    expect(detail()).toBe(layer)
    expect(layer.props.hidden).toBe(false)
    expect(output.scrollTop).toBe(123)
    const state = useChatStore.getState()
    dom.act(() =>
      useChatStore.setState({
        activeKey: 'other',
        sessions: { ...state.sessions, other: { ...state.sessions[key] } }
      })
    )
    expect(detail()).toBeNull()
    dom.act(() => useChatStore.setState({ activeKey: key }))
    expect(detail()).toBeNull()
  })
})
