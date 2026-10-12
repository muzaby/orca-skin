// 0259 r5 verify D9 · VP-01·VP-02 — 래퍼 CascadeMenu 부터 실제 Popover·CascadeBody·CascadePanel·MenuItem
// 까지 production 컴포넌트를 그대로 실행한다(renderHarness.testfixture). 사용자 입력(클릭·키·포인터)을 가짜
// DOM 에 넣고 받은 콜백·DOM 포커스·패널 배치를 관측한다. 포커스는 Electron 처럼 숨은(visibility:hidden)
// 패널 아래에서 거부된다 — 열 때·하위를 열 때 포커스가 배치 뒤 프레임에 옮겨지는지가 여기서 갈린다.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  ...(await import('./renderHarness.testfixture')).fakeHooks
}))
vi.mock('react-dom', async () => (await import('./renderHarness.testfixture')).fakeReactDom)

import { createElement } from 'react'
import { CascadeMenu } from './CascadeMenu'
import { HOVER_OPEN_DELAY_MS, type CascadeItem } from './cascadeMenuState'
import { installFakeDom, type FakeDom, type FakeNode, type Rect } from './renderHarness.testfixture'

const VIEWPORT = { width: 1000, height: 800 }
const ANCHOR: Rect = { left: 760, top: 700, width: 24, height: 24 }
const PANEL_WIDTH = 220
const ROW_HEIGHT = 28
const PADDING = 4

const items: CascadeItem<string>[] = [
  { kind: 'action', id: 'attach', label: 'Attach', action: 'attach' },
  { kind: 'separator', id: 'sep' },
  {
    kind: 'submenu',
    id: 'skills',
    label: 'Skills',
    items: [
      {
        kind: 'submenu',
        id: 'src-a',
        label: 'Source A',
        items: [
          { kind: 'action', id: 'a1', label: 'a1', title: 'A1 설명', action: 'skill:a1' },
          { kind: 'action', id: 'a2', label: 'a2', action: 'skill:a2' }
        ]
      },
      {
        kind: 'submenu',
        id: 'src-b',
        label: 'Source B',
        items: [{ kind: 'action', id: 'b1', label: 'b1', action: 'skill:b1' }]
      }
    ]
  },
  {
    kind: 'submenu',
    id: 'plugins',
    label: 'Plugins',
    items: [
      { kind: 'empty', id: 'none', label: 'None' },
      { kind: 'separator', id: 'psep' },
      { kind: 'action', id: 'manage', label: 'Manage', action: 'manage' }
    ]
  }
]

// 브라우저 레이아웃 대역: 위치가 정해진 패널(Popover 패널 · 하위 패널)은 style 좌표에, 행은 패널 안
// 순서대로 28px 씩 쌓인다. 패널 높이 = 안쪽 여백 + 행 수 × 28.
function positionedPanel(node: FakeNode): FakeNode | null {
  for (let n: FakeNode | null = node; n; n = n.parent) {
    const style = n.props.style as Record<string, unknown> | undefined
    if (style && n.props.role === 'menu') return n
  }
  return null
}

function panelRows(panel: FakeNode): FakeNode[] {
  // Popover 패널 → CascadeBody 루트 → 레벨 0 본문, 하위 패널 → 본문.
  const body =
    panel.props['data-context'] === 'floating' ? panel.children[0]?.children[0] : panel.children[0]
  return body?.children ?? []
}

function panelBox(panel: FakeNode): Rect {
  const height = PADDING * 2 + ROW_HEIGHT * panelRows(panel).length
  const style = panel.props.style as { left?: number; top?: number; bottom?: number }
  const top = style.top ?? VIEWPORT.height - (style.bottom ?? 0) - height
  return { left: style.left ?? 0, top, width: PANEL_WIDTH, height }
}

let anchorRect = ANCHOR

function layout(node: FakeNode): { rect: Rect; scrollHeight?: number } | undefined {
  if (node.props.id === 'anchor') return { rect: anchorRect }
  const panel = positionedPanel(node)
  if (!panel) return undefined
  const box = panelBox(panel)
  if (node === panel) return { rect: box, scrollHeight: box.height }
  const index = panelRows(panel).indexOf(node)
  if (index < 0) return undefined
  return {
    rect: {
      left: box.left + PADDING,
      top: box.top + PADDING + ROW_HEIGHT * index,
      width: PANEL_WIDTH - PADDING * 2,
      height: ROW_HEIGHT
    }
  }
}

interface Menu {
  dom: FakeDom
  anchor: FakeNode
  onSelect: Mock
  onClose: Mock
  setOpen: (open: boolean) => void
  root: () => FakeNode | null
  row: (level: number, index: number) => FakeNode | null
  rowText: (level: number, index: number) => string | null
  subpanel: (level: number) => FakeNode | null
}

function openMenu(menuItems: CascadeItem<string>[] = items, anchorBox: Rect = ANCHOR): Menu {
  anchorRect = anchorBox
  const dom = installFakeDom({ innerWidth: VIEWPORT.width, innerHeight: VIEWPORT.height, layout })
  const anchor = dom.createNode('button', { id: 'anchor' })
  const outside = dom.createNode('div', { id: 'outside' })
  void outside
  anchor.focus() // 사용자가 '+' 를 눌러 포커스가 앵커에 있다
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const anchorRef = { current: anchor as unknown as HTMLElement }
  const setOpen = (open: boolean): void =>
    dom.render(
      createElement(CascadeMenu<string>, {
        open,
        anchorRef,
        onClose,
        items: menuItems,
        onSelect,
        ariaLabel: 'Menu'
      })
    )
  setOpen(true)
  const row = (level: number, index: number): FakeNode | null =>
    dom.query(`[data-cascade-level="${level}"][data-cascade-index="${index}"]`)
  return {
    dom,
    anchor,
    onSelect,
    onClose,
    setOpen,
    root: () => dom.query('[aria-label="Menu"]'),
    row,
    rowText: (level, index) => row(level, index)?.textContent ?? null,
    subpanel: (level) => {
      const first = row(level, 0)
      return first ? positionedPanel(first) : null
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CascadeMenu 열기 · 키보드 (AC6 · D-007)', () => {
  it('열면 앵커 위 패널이 배치되고, 배치 뒤 프레임에 루트가 포커스를 받는다 — 숨은 패널에서는 포커스를 옮기지 않는다', () => {
    const { dom, anchor, root } = openMenu()
    const panel = dom.query('[data-context="floating"]')
    expect(panel?.props.style).toEqual({ left: 760, bottom: 106 })
    expect(dom.activeElement).toBe(anchor)
    dom.frame()
    expect(dom.activeElement).toBe(root())
    vi.unstubAllGlobals()
    // 위·아래 모두 자리가 있으면 기본 방향(위)으로 연다 — 앵커 위 6px.
    const middle = openMenu(items, { left: 100, top: 300, width: 24, height: 24 })
    expect(middle.dom.query('[data-context="floating"]')?.props.style).toEqual({
      left: 100,
      bottom: 506
    })
  })

  it('↓/↑ 는 같은 패널에서 구분선을 건너뛰고 끝에서 돌며, 그 행으로 DOM 포커스를 옮긴다 · 처리한 키는 기본 동작·문서 전파를 막는다', () => {
    const { dom, row } = openMenu()
    dom.frame()
    const down = dom.key('ArrowDown')
    expect(down.defaultPrevented).toBe(true)
    expect(down.propagationStopped).toBe(true)
    expect(dom.activeElement).toBe(row(0, 0))
    dom.key('ArrowDown')
    expect(dom.activeElement).toBe(row(0, 2))
    dom.key('ArrowDown')
    expect(dom.activeElement).toBe(row(0, 3))
    dom.key('ArrowDown')
    expect(dom.activeElement).toBe(row(0, 0))
    const up = dom.key('ArrowUp')
    expect(up.defaultPrevented).toBe(true)
    expect(dom.activeElement).toBe(row(0, 3))
    // 포커스 프레임 전에 다음 키가 와도 이전 행에서 루트로 올라가 최신 상태로 처리된다.
    dom.keyDown('ArrowDown')
    dom.keyDown('ArrowDown')
    dom.frame()
    expect(dom.activeElement).toBe(row(0, 2))
  })

  it('→·Enter·Space 는 하위를 열고 첫 활성 항목으로, ←·Esc 는 한 단계만 닫고 부모 항목으로 포커스를 옮긴다', () => {
    const { dom, row, rowText, onClose, onSelect } = openMenu()
    dom.frame()
    dom.key('ArrowDown')
    dom.key('ArrowDown')
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('false')
    expect(dom.key('ArrowRight').defaultPrevented).toBe(true)
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('true')
    expect(dom.activeElement).toBe(row(1, 0))
    expect(rowText(1, 0)).toBe('Source A')
    expect(dom.key('Enter').defaultPrevented).toBe(true)
    expect(dom.activeElement).toBe(row(2, 0))
    expect(rowText(2, 0)).toBe('a1')
    expect(dom.key('ArrowLeft').defaultPrevented).toBe(true)
    expect(row(2, 0)).toBeNull()
    expect(dom.activeElement).toBe(row(1, 0))
    expect(dom.key(' ').defaultPrevented).toBe(true)
    expect(dom.activeElement).toBe(row(2, 0))
    const escape = dom.key('Escape')
    expect(escape.propagationStopped).toBe(true)
    expect(row(2, 0)).toBeNull()
    expect(dom.activeElement).toBe(row(1, 0))
    dom.key('ArrowDown')
    expect(dom.activeElement).toBe(row(1, 1))
    dom.key('ArrowLeft')
    expect(row(1, 0)).toBeNull()
    expect(dom.activeElement).toBe(row(0, 2))
    // 비어 있는 안내 행·구분선은 건너뛰고 첫 활성 항목으로 간다.
    dom.key('ArrowDown')
    dom.key('ArrowRight')
    expect(dom.activeElement).toBe(row(1, 2))
    expect(rowText(1, 2)).toBe('Manage')
    expect(onClose).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Enter·Space 로 동작 항목을 고르면 받은 onSelect 를 그 동작으로 1회, onClose 를 1회 부른다', () => {
    const first = openMenu()
    first.dom.frame()
    first.dom.key('ArrowDown')
    first.dom.key('Enter')
    expect(first.onSelect).toHaveBeenCalledExactlyOnceWith('attach')
    expect(first.onClose).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()

    const second = openMenu()
    second.dom.frame()
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowDown'])
      second.dom.key(key)
    expect(second.dom.activeElement).toBe(second.row(2, 1))
    second.dom.key(' ')
    expect(second.onSelect).toHaveBeenCalledExactlyOnceWith('skill:a2')
    expect(second.onClose).toHaveBeenCalledOnce()
  })

  it('최상위 Esc 는 래퍼가 받은 onClose 를 부르고 앵커로 포커스를 돌린다 · 처리하지 않는 키는 문서로 간다', () => {
    const { dom, anchor, root, onClose, setOpen } = openMenu()
    dom.frame()
    const documentKeys: string[] = []
    dom.documentListeners.get('keydown')?.add((event) => {
      documentKeys.push((event as { key: string }).key)
    })
    const other = dom.key('a')
    expect(other.defaultPrevented).toBe(false)
    expect(documentKeys).toEqual(['a'])
    expect(dom.activeElement).toBe(root())
    dom.key('Escape')
    expect(onClose).toHaveBeenCalledOnce()
    expect(dom.activeElement).toBe(anchor)
    expect(documentKeys).toEqual(['a'])
    setOpen(false)
    expect(root()).toBeNull()
    expect(dom.activeElement).toBe(anchor)
  })

  it('닫았다 다시 열면 열린 하위·포커스가 처음 상태다', () => {
    const { dom, row, root, setOpen } = openMenu()
    dom.frame()
    dom.key('ArrowDown')
    dom.key('ArrowDown')
    dom.key('ArrowRight')
    expect(row(1, 0)).not.toBeNull()
    setOpen(false)
    setOpen(true)
    dom.frame()
    expect(row(1, 0)).toBeNull()
    expect(dom.activeElement).toBe(root())
    dom.key('ArrowDown')
    expect(dom.activeElement).toBe(row(0, 0))
  })
})

describe('CascadeMenu 포인터 (AC7 · D-007)', () => {
  it('하위 항목 hover 는 150ms 뒤에 열고, 열린 하위 패널(레벨 1) 항목 hover 도 그 레벨로 다음 하위를 연다', () => {
    const { dom, row, rowText } = openMenu()
    expect(HOVER_OPEN_DELAY_MS).toBe(150)
    dom.pointerTo(row(0, 2))
    dom.advance(149)
    expect(row(1, 0)).toBeNull()
    dom.advance(1)
    expect(rowText(1, 0)).toBe('Source A')
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('true')
    dom.pointerTo(row(1, 0))
    dom.advance(150)
    expect([rowText(2, 0), rowText(2, 1)]).toEqual(['a1', 'a2'])
    // 형제 하위로 옮기면 다음 레벨이 그 형제의 하위로 바뀐다.
    dom.pointerTo(row(1, 1))
    dom.advance(150)
    expect([rowText(2, 0), row(2, 1)]).toEqual(['b1', null])
    expect(rowText(1, 0)).toBe('Source A')
    // 최상위 동작 항목 hover 는 그 레벨 아래의 열린 하위를 닫는다.
    dom.pointerTo(row(0, 0))
    dom.advance(150)
    expect(row(1, 0)).toBeNull()
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('false')
  })

  it('150ms 전에 다른 항목으로 옮기거나 메뉴를 떠나면 먼저 항목은 열리지 않는다', () => {
    const { dom, row, rowText } = openMenu()
    dom.pointerTo(row(0, 2))
    dom.advance(100)
    dom.pointerTo(row(0, 3))
    dom.advance(50)
    expect(row(1, 2)).toBeNull()
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('false')
    dom.advance(100)
    expect(rowText(1, 2)).toBe('Manage')
    dom.pointerTo(row(0, 2))
    dom.advance(100)
    dom.pointerTo(null)
    dom.advance(500)
    expect(rowText(1, 2)).toBe('Manage')
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('false')
  })

  it('클릭으로 하위를 열고 깊은 동작 항목을 고르면 onSelect 를 그 동작으로 1회, onClose 를 1회 부른다 — 하위 패널 안 mousedown 은 메뉴를 닫지 않는다', () => {
    const { dom, row, rowText, onSelect, onClose } = openMenu()
    dom.click(row(0, 2) as FakeNode)
    expect(rowText(1, 0)).toBe('Source A')
    dom.click(row(1, 1) as FakeNode)
    expect(rowText(2, 0)).toBe('b1')
    dom.click(row(1, 0) as FakeNode)
    expect(rowText(2, 1)).toBe('a2')
    expect(onClose).not.toHaveBeenCalled()
    dom.click(row(2, 1) as FakeNode)
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('skill:a2')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('바깥 mousedown 은 onClose 를 부르고, 앵커 mousedown 은 부르지 않는다', () => {
    const { dom, anchor, onClose } = openMenu()
    dom.mouseDown(anchor)
    expect(onClose).not.toHaveBeenCalled()
    dom.mouseDown(dom.query('[id="outside"]') as FakeNode)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('CascadeMenu 하위 패널 배치 (AC8 · D-008)', () => {
  it('열린 하위 패널은 부모 행 좌표·패널 크기·화면 크기로 배치되고(오른쪽이 넘치면 왼쪽), 형제 하위로 바뀌면 다시 잰다', () => {
    const { dom, row, subpanel } = openMenu()
    expect(subpanel(1)).toBeNull()
    dom.click(row(0, 2) as FakeNode)
    // 부모 행 left 764 · right 976 · top 634 → 오른쪽(980+220)이 넘쳐 왼쪽 764-4-220.
    expect(subpanel(1)?.props.style).toEqual({ left: 540, top: 630, maxHeight: 784 })
    dom.click(row(1, 0) as FakeNode)
    // 부모 행 left 544 · right 756 · top 634 → 오른쪽 760 이 들어간다.
    expect(subpanel(2)?.props.style).toEqual({ left: 760, top: 630, maxHeight: 784 })
    dom.click(row(1, 1) as FakeNode)
    expect(subpanel(2)?.props.style).toEqual({ left: 760, top: 658, maxHeight: 784 })
  })

  it('화면 높이를 넘는 하위 목록은 위로 밀고 최대 높이를 화면 높이 − 16 으로 둔다', () => {
    const long: CascadeItem<string>[] = [
      {
        kind: 'submenu',
        id: 'many',
        label: 'Many',
        items: Array.from({ length: 30 }, (_, i) => ({
          kind: 'action' as const,
          id: `m${i}`,
          label: `m${i}`,
          action: `m${i}`
        }))
      }
    ]
    const { dom, row, subpanel } = openMenu(long)
    dom.click(row(0, 0) as FakeNode)
    // 내용 높이 8 + 30×28 = 848 > 784 → 높이 784 로 보고 top = 800 − 8 − 784 = 8.
    expect(subpanel(1)?.props.style).toEqual({ left: 540, top: 8, maxHeight: 784 })
  })
})

describe('CascadeMenu 접근성 · 설명 (AC1·AC5 · §5 a11y)', () => {
  it('루트 role=menu·aria-label, 하위 행 aria-haspopup, 구분선 separator, 빈 안내 행 aria-disabled, 동작 행 title', () => {
    const { dom, root, row } = openMenu()
    expect(root()?.getAttribute('role')).toBe('menu')
    expect(row(0, 0)?.getAttribute('role')).toBe('menuitem')
    expect(row(0, 0)?.getAttribute('aria-haspopup')).toBeNull()
    expect(row(0, 2)?.getAttribute('aria-haspopup')).toBe('menu')
    expect(row(0, 3)?.getAttribute('aria-haspopup')).toBe('menu')
    expect(dom.queryAll('[role="separator"]')).toHaveLength(1)
    // 하위가 있는 행만 끝에 펼침 표시(chevron) 아이콘이 있다.
    const icons = (node: FakeNode | null): number =>
      node?.children.filter((child) => child.tag === 'svg').length ?? -1
    expect([icons(row(0, 0)), icons(row(0, 2)), icons(row(0, 3))]).toEqual([0, 1, 1])
    dom.click(row(0, 3) as FakeNode)
    expect(dom.queryAll('[aria-disabled]').map((node) => node.textContent)).toEqual(['None'])
    expect(row(0, 3)?.getAttribute('aria-expanded')).toBe('true')
    expect(row(0, 2)?.getAttribute('aria-expanded')).toBe('false')
    dom.click(row(0, 2) as FakeNode)
    dom.click(row(1, 0) as FakeNode)
    expect(row(2, 0)?.getAttribute('title')).toBe('A1 설명')
    expect(row(2, 1)?.getAttribute('title')).toBeNull()
  })
})
