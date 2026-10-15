import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Children,
  createElement,
  isValidElement,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { useChatStore } from '../../store/chatStore'
import { useArtifactViewerStore } from '../../store/artifactViewerStore'
import { RightPanelTile } from './RightPanelTile'
import { TilePanel, type TilePanelDetail } from './TilePanel'

// Zustand's SSR snapshot is explicit here. Browser mount/scroll/focus retention is covered by CUA.
const chat = useChatStore.getInitialState()
const entry = chat.sessions[chat.activeKey]
const originalSession = entry.session
const artifacts = useArtifactViewerStore.getInitialState()
const originalArtifact = artifacts.selection
const close = vi.fn()

function detail(): TilePanelDetail {
  const fixture: ComponentProps<typeof RightPanelTile> = {
    id: 'diff',
    defaultLabelKey: 'chat.rightpanel.tiles.diff',
    taskTileChrome: 'standard',
    onClose: close,
    children: createElement('p', { 'data-detail-content': '' }, 'Detail changes')
  }
  return {
    key: 'detail:diff',
    expanded: false,
    width: 640,
    onWidthChange: vi.fn(),
    onClose: close,
    content: createElement(RightPanelTile, fixture)
  }
}

function render(selection?: TilePanelDetail): {
  $: ReturnType<typeof load>
  tree: ReactNode
} {
  let tree: ReactNode
  function Capture(): React.JSX.Element | null {
    const result = TilePanel({ detail: selection })
    tree = result
    return result
  }
  const html = renderToStaticMarkup(createElement(Capture))
  return { $: load(html), tree }
}

function all(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(tree).flatMap((node) =>
    isValidElement<Record<string, unknown>>(node)
      ? [node, ...all(node.props.children as ReactNode)]
      : []
  )
}

function openArtifact(sessionKey = chat.activeKey): void {
  artifacts.selection = {
    sessionKey,
    sessionId: 'session',
    artifact: {
      publicationId: 'publication',
      artifactFileId: 'file',
      title: 'Output',
      filename: 'output.txt',
      kind: 'text',
      sizeBytes: 6,
      publishedAt: 1
    },
    request: 1,
    loading: false,
    mode: 'code',
    expanded: false,
    result: { state: 'ready', format: 'text', content: 'Output', mimeType: 'text/plain' }
  }
}

beforeEach(() => {
  close.mockClear()
  artifacts.selection = null
  entry.session = {
    ...originalSession,
    sessionId: 'session',
    backend: 'opencode',
    agentKind: 'code',
    cwd: 'C:/orca',
    rightPanelTiles: [{ id: 'task', tiles: ['task', 'diff'] }],
    selectedProcessToolId: 'original-process',
    selectedSubagentTaskId: 'original-agent'
  }
})

afterEach(() => {
  entry.session = originalSession
  artifacts.selection = originalArtifact
})

describe('detail layer in the shared tile host', () => {
  it('keeps the original tiles hidden and inert beneath a detail without changing their state', () => {
    const session = entry.session
    const { $ } = render(detail())
    const overview = $('[data-artifact-overview]')
    expect(overview.is('[hidden][inert]')).toBe(true)
    expect(overview.find('[data-context="task"]')).toHaveLength(1)
    expect(overview.find('[data-context="diff"]')).toHaveLength(1)
    const layer = $('[data-panel-detail="detail:diff"]')
    expect(layer.is('[hidden], [inert]')).toBe(false)
    expect(layer.find('[data-detail-content]').text()).toBe('Detail changes')
    expect(layer.find('.app-frame-tile-header')).toHaveLength(1)
    expect(layer.find('[data-panel-close]')).toHaveLength(1)
    expect(layer.find('[data-resizable-side-pane]').attr('style')).toContain('width:640px')
    expect(entry.session).toBe(session)
    expect(entry.session.selectedProcessToolId).toBe('original-process')
    expect(entry.session.selectedSubagentTaskId).toBe('original-agent')
  })

  it('keeps detail content beneath an artifact, then exposes detail and the original tiles in order', () => {
    const selection = detail()
    openArtifact()
    const layered = render(selection).$
    expect(layered('[data-artifact-overview]').is('[hidden][inert]')).toBe(true)
    expect(layered('[data-panel-detail]').is('[hidden][inert]')).toBe(true)
    expect(layered('[data-panel-detail] [data-detail-content]')).toHaveLength(1)
    expect(layered('[data-artifact-viewer="publication"]')).toHaveLength(1)
    artifacts.selection = null
    const returned = render(selection).$
    expect(returned('[data-panel-detail]').is('[hidden], [inert]')).toBe(false)
    expect(returned('[data-artifact-overview]').is('[hidden][inert]')).toBe(true)
    const closed = render().$
    expect(closed('[data-panel-detail]')).toHaveLength(0)
    expect(closed('[data-artifact-overview]').is('[hidden], [inert]')).toBe(false)
    expect(closed('[data-panel-tiles="task diff"]')).toHaveLength(1)
  })

  it('does not apply another session artifact to the active detail', () => {
    openArtifact('another-session')
    const { $ } = render(detail())
    expect($('[data-artifact-viewer]')).toHaveLength(0)
    expect($('[data-panel-detail]').is('[hidden], [inert]')).toBe(false)
  })

  it('shows a detail even when the original tile layout is empty', () => {
    entry.session = { ...entry.session, rightPanelTiles: [] }
    expect(render(detail()).$('[data-panel-detail]')).toHaveLength(1)
    expect(render().$('[data-artifact-overview]')).toHaveLength(0)
  })

  it.each(['none', 'popup', 'hidden-popup', 'prevented', 'other-key', 'artifact'] as const)(
    'handles the actual detail Escape callback with %s',
    (condition) => {
      if (condition === 'artifact') openArtifact()
      const { tree } = render(detail())
      const layer = all(tree).find((node) => node.props['data-panel-detail'] === 'detail:diff')!
      const popups =
        condition === 'popup' || condition === 'hidden-popup'
          ? [{ closest: () => (condition === 'hidden-popup' ? {} : null) }]
          : []
      const event = {
        key: condition === 'other-key' ? 'Enter' : 'Escape',
        defaultPrevented: condition === 'prevented',
        currentTarget: { ownerDocument: { querySelectorAll: vi.fn(() => popups) } },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      }
      ;(layer.props.onKeyDown as (event: KeyboardEvent<HTMLDivElement>) => void)(
        event as unknown as KeyboardEvent<HTMLDivElement>
      )
      const closes = condition === 'none' || condition === 'hidden-popup'
      expect(close).toHaveBeenCalledTimes(closes ? 1 : 0)
      expect(event.preventDefault).toHaveBeenCalledTimes(closes ? 1 : 0)
      expect(event.stopPropagation).toHaveBeenCalledTimes(closes ? 1 : 0)
    }
  )
})
