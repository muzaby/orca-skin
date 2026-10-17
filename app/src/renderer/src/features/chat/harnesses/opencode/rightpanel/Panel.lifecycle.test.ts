import { createElement } from 'react'
import type { StateCreator } from 'zustand/vanilla'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  FakeNode
} from '../../../../../shared/ui/renderHarness.testfixture'
import { RightPanel } from '../../../components/rightpanel/RightPanel'
import { useChatStore } from '../../../store/chatStore'
import { useArtifactViewerStore, closeArtifactViewer } from '../../../store/artifactViewerStore'
import type { ChatState } from '../../../reducer/chatReducer'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
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

let dom: FakeDom
const initial = useChatStore.getState()
const initialArtifacts = useArtifactViewerStore.getState()
const all = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(all)]
const buttons = (root: FakeNode): FakeNode[] => all(root).filter((node) => node.tag === 'button')
const overview = (): FakeNode => dom.query('[data-component="opencode-session-panel"]')!
const detail = (): FakeNode | null => dom.query('[data-panel-detail]')
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
  dom.render(createElement('div', { 'data-side-pane-host': '' }, createElement(RightPanel)))
}
beforeEach(() => {
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
  update({
    sessionId: 'panel-session',
    backend: 'opencode',
    agentKind: 'code',
    cwd: 'C:/orca',
    extraDirs: ['C:/references'],
    rightPanelTiles: [{ id: 'task', tiles: ['task'] }],
    rightPanelColWidths: [420],
    selectedSubagentTaskId: 'base-agent',
    messages: [
      {
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
  it('inherits the task column width and restores detail scroll after expansion', () => {
    update({
      rightPanelTiles: [
        { id: 'source', tiles: ['source'] },
        { id: 'task', tiles: ['task'] }
      ],
      rightPanelColWidths: [300, 480]
    })
    mount()
    const base = overview()
    dom.click(entry('diff'))
    const pane = detail()!.querySelector('[data-resizable-side-pane]')!
    const surface = pane.querySelector('[data-side-pane-surface]')!
    expect(pane.props.style).toMatchObject({ width: 488 })
    const resize = pane.querySelector('[data-side-pane-resize]')!
    dom.act(() => resize.focus())
    dom.key('ArrowLeft')
    expect(session().rightPanelColWidths[0]).toBe(300)
    expect(session().rightPanelColWidths[1]).toBeGreaterThan(480)
    const resized = session().rightPanelColWidths[1]
    pane.scrollTop = 76
    dom.act(() => (pane.props.onScrollCapture as (event: unknown) => void)({ target: pane }))
    dom.click(detail()!.querySelector('[data-diff-expand-panel]')!)
    expect(surface.props['data-side-pane-expanded']).toBe(true)
    expect(pane.querySelector('[data-side-pane-resize]')).toBeNull()
    pane.scrollTop = 0
    dom.click(detail()!.querySelector('[data-diff-expand-panel]')!)
    expect(surface.props['data-side-pane-expanded']).toBeUndefined()
    expect(pane.scrollTop).toBe(76)
    expect(pane.props.style).toMatchObject({ width: resized + 8 })
    dom.click(detail()!.querySelector('[data-panel-close]')!)
    expect(overview()).toBe(base)
    expect(session().rightPanelColWidths).toEqual([300, resized])
  })
  it.each(['diff', 'subagent', 'process', 'source'] as const)(
    'opens %s from the summary and closes back to the same overview',
    (kind) => {
      mount()
      const base = overview()
      const tiles = session().rightPanelTiles
      const origin = entry(kind)
      dom.click(origin)
      expect(detail()?.querySelector(`[data-context="${kind}"]`)).not.toBeNull()
      expect(detail()?.props.hidden).toBe(false)
      expect(dom.query('[data-artifact-overview]')?.props.inert).toBe(true)
      expect(detail()?.querySelectorAll('[data-panel-close]')).toHaveLength(1)
      expect(session().rightPanelTiles).toBe(tiles)
      expect(overview()).toBe(base)
      expect(dom.activeElement).toBe(detail()!.querySelector('[data-panel-close]'))
      dom.click(detail()!.querySelector('[data-panel-close]')!)
      expect(detail()).toBeNull()
      expect(overview()).toBe(base)
      expect(dom.activeElement).toBe(origin)
      expect(session().rightPanelTiles).toBe(tiles)
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
    dom.click(detail()!.querySelector('[data-panel-close]')!)
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
    expect(detail()).toBe(layer)
    expect(layer.props.hidden).toBe(true)
    expect(dom.query('[data-artifact-viewer]')).not.toBeNull()
    dom.act(() => closeArtifactViewer(key))
    expect(detail()).toBe(layer)
    expect(layer.props.hidden).toBe(false)
    expect(output.scrollTop).toBe(123)
    const state = useChatStore.getState()
    dom.act(() =>
      useChatStore.setState({
        activeKey: 'other',
        sessions: { ...state.sessions, other: { ...state.sessions[key], panelReveal: undefined } }
      })
    )
    expect(detail()).toBeNull()
    dom.act(() => useChatStore.setState({ activeKey: key }))
    expect(detail()).toBeNull()
  })
})
