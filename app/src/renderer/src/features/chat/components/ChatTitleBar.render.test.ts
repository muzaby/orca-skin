// 0213 배지 계약 + 0262 ΔV9 EP-31a/b — 실제 ChatTitleBar 메뉴의 항목·순서·토글.
// Popover의 DOM 포털만 대체하고 실제 메뉴 children과 MenuItem 렌더 결과를 관측한다.
// 정책/registry 상수만 검사하면 소비자가 다른 목록을 조립하는 회귀를 놓친다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RightPanelColumns } from '../lib/rightPanelLayout'
import type { RightPanelTileId } from '../lib/rightPanelTiles'
import type { MenuItemProps } from '../../../shared/ui/MenuItem'

const { sessionState, unseenCount, toggleTile, menu } = vi.hoisted(() => ({
  sessionState: {
    value: {
      title: '작업 중인 대화',
      agentKind: 'code' as 'code' | 'work',
      backend: 'claude' as 'claude' | 'opencode',
      messages: [],
      cwd: '/repo',
      worktree: null,
      sessionId: 's1',
      rightPanelTiles: [] as RightPanelColumns,
      rightPanelTileLabels: {} as Record<string, string>
    }
  },
  unseenCount: { value: 0 },
  toggleTile: vi.fn(),
  menu: { children: null as ReactNode }
}))

vi.mock('../store/chatStore', () => ({
  chatActions: { toggleRightPanelTile: toggleTile, selectTask: vi.fn(), setPendingCwd: vi.fn() },
  getActiveChatSession: () => sessionState.value,
  useChatSession: (select: (s: unknown) => unknown) => select(sessionState.value),
  useUnseenSettledTaskCount: () => unseenCount.value
}))
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key })
}))
vi.mock('../../../shared/ui/Popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => {
    menu.children = children
    return createElement('div', { role: 'menu' }, children)
  }
}))
// cwd 칩은 이 계약의 대상이 아니다 — 자기 IPC를 물지 않게 형상만 남긴다.
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))

const { ChatTitleBar } = await import('./ChatTitleBar')
const { tileById } = await import('./rightpanel/tileRegistry')

beforeEach(() => {
  vi.clearAllMocks()
  sessionState.value.agentKind = 'code'
  sessionState.value.backend = 'claude'
  sessionState.value.rightPanelTileLabels = {}
  menu.children = null
})

function render(opts: { unseen?: number; activeTiles?: string[] } = {}): string {
  unseenCount.value = opts.unseen ?? 0
  sessionState.value.rightPanelTiles = (
    opts.activeTiles?.length ? [{ id: 'c1', tiles: opts.activeTiles }] : []
  ) as RightPanelColumns
  return renderToStaticMarkup(createElement(ChatTitleBar, {}))
}

function renderedTileItems(markup: string): Array<{ label: string; active: boolean }> {
  return [
    ...markup.matchAll(/<button\b([^>]*role="menuitemcheckbox"[^>]*)>([\s\S]*?)<\/button>/g)
  ].map(([, attributes, content]) => ({
    label: content.match(/<span>([^<]*)<\/span>/)?.[1] ?? '',
    active: attributes.includes('aria-checked="true"')
  }))
}

function tileCallbacks(nodes: ReactNode = menu.children): MenuItemProps[] {
  return Children.toArray(nodes).flatMap((node) => {
    if (!isValidElement<MenuItemProps>(node)) return []
    return node.props.role === 'menuitemcheckbox'
      ? [node.props]
      : tileCallbacks(node.props.children ?? null)
  })
}

const BADGE_ARIA = 'chat.taskTile.badgeAria'
const TILE_LABEL = 'chat.rightpanel.tiles.'
const menuCases = [
  { backend: 'claude', kind: 'code', ids: ['plan', 'subagent', 'diff'] },
  { backend: 'claude', kind: 'work', ids: ['task'] },
  {
    backend: 'opencode',
    kind: 'code',
    ids: ['plan', 'subagent', 'task', 'diff', 'process', 'source']
  }
] as const

describe('실제 타일 메뉴 — 평면 목록과 토글 (0262 ΔV9 EP-31a/b)', () => {
  it.each(menuCases)(
    '$backend $kind의 기존 순서·지원 항목과 타일 표시 제목을 보존한다',
    ({ backend, kind, ids }) => {
      sessionState.value.backend = backend
      sessionState.value.agentKind = kind
      const markup = render()
      expect(renderedTileItems(markup)).toEqual(
        ids.map((id) => ({ label: TILE_LABEL + id, active: false }))
      )
      expect(markup).toContain('>chat.titleBar.tilesHeader</div>')
      expect(markup).not.toContain('role="group"')
      expect(markup).not.toContain('chat.rightpanel.category.')
      expect(markup).not.toContain(TILE_LABEL + 'artifacts')
      expect(markup.indexOf('chat.titleBar.tilesHeader')).toBeLessThan(markup.indexOf(TILE_LABEL))
      for (const item of renderedTileItems(markup)) {
        const id = item.label.slice(TILE_LABEL.length) as RightPanelTileId
        const tile = tileById(id, backend)
        expect(tile.id).toBe(id)
        expect(tile.defaultLabelKey).toBe(item.label)
        expect(tile.Content).toBeTypeOf('function')
      }
    }
  )

  it.each(menuCases)(
    '$backend $kind의 모든 항목이 자신의 타일을 토글하고 현재 선택을 표시한다',
    ({ backend, kind, ids }) => {
      sessionState.value.backend = backend
      sessionState.value.agentKind = kind
      const markup = render({ activeTiles: [ids[0]] })
      expect(renderedTileItems(markup).map((item) => item.active)).toEqual(
        ids.map((_, index) => index === 0)
      )
      const callbacks = tileCallbacks()
      expect(callbacks).toHaveLength(ids.length)
      callbacks.forEach((item, index) => {
        expect(item.icon).toBe(index === 0 ? 'check' : 'plus')
        item.onClick?.({} as React.MouseEvent<HTMLButtonElement>)
        expect(toggleTile).toHaveBeenNthCalledWith(index + 1, ids[index])
      })
      expect(toggleTile).toHaveBeenCalledTimes(ids.length)
    }
  )

  it('런타임 타일 제목과 기존 제목·복사·메뉴 컨트롤을 보존한다', () => {
    sessionState.value.rightPanelTileLabels = { plan: '현재 계획' }
    const markup = render()
    expect(renderedTileItems(markup)[0].label).toBe('현재 계획')
    expect(markup).toContain('작업 중인 대화')
    expect(markup).toContain('aria-label="chat.titleBar.copyAll"')
    expect(markup).toContain('aria-label="chat.titleBar.tilesButton"')
  })
})

describe('미확인 완료 배지 — 술어에서 실제 메뉴까지 (0213 AT-05/06)', () => {
  it.each(['code', 'work'] as const)(
    'Claude %s의 대상 타일이 닫혀 있으면 컨트롤과 메뉴에 배지를 표시한다',
    (kind) => {
      sessionState.value.agentKind = kind
      const markup = render({ unseen: 2 })
      expect(markup).toContain(BADGE_ARIA)
      const items = tileCallbacks()
      expect(renderToStaticMarkup(createElement('div', {}, items[0].children))).toContain(
        '>2</span>'
      )
      for (const item of items.slice(1)) {
        expect(renderToStaticMarkup(createElement('div', {}, item.children))).not.toContain(
          '>2</span>'
        )
      }
    }
  )

  it.each([
    { kind: 'code', target: 'plan' },
    { kind: 'work', target: 'task' }
  ] as const)('Claude $kind의 대상 타일을 보고 있으면 배지가 없다', ({ kind, target }) => {
    sessionState.value.agentKind = kind
    const markup = render({ unseen: 2, activeTiles: [target] })
    expect(markup).not.toContain(BADGE_ARIA)
    expect(markup).not.toContain('>2</span>')
  })

  it('미확인이 없으면 배지가 없다', () => {
    expect(render({ unseen: 0 })).not.toContain(BADGE_ARIA)
  })

  it('OpenCode는 Claude 완료 배지를 노출하지 않는다', () => {
    sessionState.value.backend = 'opencode'
    const markup = render({ unseen: 2 })
    expect(markup).not.toContain(BADGE_ARIA)
    expect(markup).not.toContain('>2</span>')
  })
})
