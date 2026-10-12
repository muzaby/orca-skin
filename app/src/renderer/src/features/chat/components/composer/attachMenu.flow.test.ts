// 0259 r5 verify D9 · VP-01 — '+' 칩부터 AttachMenu → 실제 CascadeMenu·Popover·MenuItem 까지 production
// 컴포넌트를 그대로 실행한다(shared/ui/renderHarness.testfixture). 사람이 하위 메뉴를 열어 고른 항목이
// 컨트롤러가 받는 onAction·onManagePlugins·onClose 로 나오는지, 목록이 바뀌면 열린 메뉴가 새 목록을
// 그리는지 관측한다. 문구는 키 그대로 내는 tr 로 대체해 라벨 키 배선을 직접 본다.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock(
  'react-dom',
  async () => (await import('../../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
const i18n = vi.hoisted(() => ({ tr: (key: string): string => key }))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: i18n.tr, locale: 'ko' }) }))

import { createElement } from 'react'
import type { SkillInfo } from '../../../../../../shared/ipc'
import type { PluginMention } from '../../lib/pluginMention'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { AttachMenu } from './AttachMenu'
import { ComposerChip } from './ComposerChip'

const skills = [
  { name: 'review', sourceId: 'orca', sourceLabel: 'Orcinus orca 스킬', description: '리뷰' },
  { name: 'plan', sourceId: 'adapter:claude', sourceLabel: 'CLAUDE 스킬', description: '' },
  { name: 'ship', sourceId: 'adapter:claude', sourceLabel: 'CLAUDE 스킬', description: '' }
] as SkillInfo[]
const plugins: PluginMention[] = [
  { kind: 'plugin', id: 'jira-dc', label: 'Jira DC' },
  { kind: 'plugin', id: 'confluence', label: 'Confluence' }
]

interface Harness {
  dom: FakeDom
  anchor: FakeNode
  onAction: Mock
  onClose: Mock
  onManagePlugins: Mock
  render: (props?: Partial<Parameters<typeof AttachMenu>[0]>) => void
  row: (level: number, index: number) => FakeNode
  texts: (level: number) => string[]
}

function mountMenu(props: Partial<Parameters<typeof AttachMenu>[0]> = {}): Harness {
  // 레이아웃은 보지 않는다(배치는 CascadeMenu.flow) — 상자 0 이어도 Popover·하위 패널은 위치를 잡는다.
  const dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
  const anchor = dom.createNode('button', { id: 'anchor' })
  anchor.focus()
  const onAction = vi.fn()
  const onClose = vi.fn()
  const onManagePlugins = vi.fn()
  const anchorRef = { current: anchor as unknown as HTMLButtonElement }
  let current: Parameters<typeof AttachMenu>[0] = {
    open: true,
    anchorRef,
    onClose,
    skills,
    plugins,
    onAction,
    onManagePlugins,
    ...props
  }
  const render = (next: Partial<Parameters<typeof AttachMenu>[0]> = {}): void => {
    current = { ...current, ...next }
    dom.render(createElement(AttachMenu, current))
  }
  render()
  const row = (level: number, index: number): FakeNode => {
    const node = dom.query(`[data-cascade-level="${level}"][data-cascade-index="${index}"]`)
    if (!node) throw new Error(`row(${level},${index}) not rendered`)
    return node
  }
  const texts = (level: number): string[] =>
    dom.queryAll(`[data-cascade-level="${level}"]`).map((node) => node.textContent)
  return { dom, anchor, onAction, onClose, onManagePlugins, render, row, texts }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("'+' 칩 (VP-01 '+' → AttachMenu)", () => {
  it('받은 onClick·ref 를 버튼에 그대로 달고 하위 메뉴 표시를 aria 로 낸다', () => {
    const dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
    const ref = { current: null as HTMLButtonElement | null }
    const onClick = vi.fn()
    dom.render(
      createElement(ComposerChip, {
        ref,
        icon: 'plus',
        onClick,
        ariaHasPopup: true,
        ariaExpanded: false,
        title: '추가'
      })
    )
    const button = dom.query('[title="추가"]') as FakeNode
    expect(ref.current).toBe(button)
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    dom.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('AttachMenu → CascadeMenu (AC1 · D-001)', () => {
  it('열리면 최상위 4행(파일 추가 · 구분선 · 스킬 ▸ · 플러그인 ▸)을 라벨 키 순서대로 그리고 메뉴 이름을 단다', () => {
    const { dom, row, texts } = mountMenu()
    expect(texts(0)).toEqual([
      'chat.composer.attachMenu.addFiles',
      'chat.composer.attachMenu.skills',
      'chat.composer.attachMenu.plugins'
    ])
    expect(dom.queryAll('[role="separator"]')).toHaveLength(1)
    expect(row(0, 2).getAttribute('aria-haspopup')).toBe('menu')
    expect(row(0, 3).getAttribute('aria-haspopup')).toBe('menu')
    expect(dom.query('[aria-label="chat.composer.attachMenuTitle"]')?.getAttribute('role')).toBe(
      'menu'
    )
  })

  it('닫힌 채 마운트돼도(컨트롤러 초기 상태) 열면 배치·포커스·바깥 클릭 닫기가 동작한다', () => {
    const { dom, render, texts, onClose } = mountMenu({ open: false })
    expect(dom.query('[role="menu"]')).toBeNull()
    render({ open: true })
    expect(texts(0)).toHaveLength(3)
    dom.frame()
    expect(dom.activeElement).toBe(dom.query('[aria-label="chat.composer.attachMenuTitle"]'))
    dom.mouseDown(dom.createNode('div'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('빈 목록이면 비활성 안내 행 키를, 관리 콜백이 있으면 플러그인 하위 끝에 관리 행 키를 그린다', () => {
    const { dom, row, texts } = mountMenu({ skills: [], plugins: [] })
    dom.click(row(0, 2))
    expect(dom.queryAll('[aria-disabled]').map((node) => node.textContent)).toEqual([
      'chat.composer.attachMenu.noSkills'
    ])
    dom.click(row(0, 3))
    expect(dom.queryAll('[aria-disabled]').map((node) => node.textContent)).toEqual([
      'chat.composer.attachMenu.noPlugins'
    ])
    expect(texts(1)).toEqual(['chat.composer.attachMenu.managePlugins'])
  })
})

describe('AttachMenu 선택 → 컨트롤러 콜백 (AC2·AC3 · D-002·D-003)', () => {
  it('스킬 ▸ 출처 ▸ 스킬을 클릭하면 onAction(skill) 1회 · onClose 1회 · 관리 콜백 없음', () => {
    const { dom, row, texts, onAction, onClose, onManagePlugins } = mountMenu()
    dom.click(row(0, 2))
    expect(texts(1)).toEqual(['Orcinus orca 스킬', 'CLAUDE 스킬'])
    dom.click(row(1, 1))
    expect(texts(2)).toEqual(['plan', 'ship'])
    dom.click(row(2, 1))
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'skill', name: 'ship' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(onManagePlugins).not.toHaveBeenCalled()
  })

  it('플러그인 ▸ 플러그인을 키보드로 고르면 onAction(plugin) 1회', () => {
    const { dom, row, onAction, onClose } = mountMenu()
    dom.frame()
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown'])
      dom.key(key)
    expect(dom.activeElement).toBe(row(1, 1))
    dom.key('Enter')
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'plugin', id: 'confluence' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("'플러그인 관리'는 onManagePlugins 1회 · onAction 없음 · onClose 1회", () => {
    const { dom, row, texts, onAction, onClose, onManagePlugins } = mountMenu()
    dom.click(row(0, 3))
    expect(texts(1)).toEqual(['Jira DC', 'Confluence', 'chat.composer.attachMenu.managePlugins'])
    dom.click(row(1, 3))
    expect(onManagePlugins).toHaveBeenCalledOnce()
    expect(onAction).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("'파일 또는 사진 추가'는 onAction(attach) 1회", () => {
    const { dom, row, onAction } = mountMenu()
    dom.click(row(0, 0))
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'attach' })
  })

  it("최상위 Esc 는 AttachMenu 가 받은 onClose 를 부르고 받은 anchorRef('+' 칩)로 포커스를 돌린다", () => {
    const { dom, anchor, onClose } = mountMenu()
    dom.frame()
    expect(dom.activeElement).not.toBe(anchor)
    dom.key('Escape')
    expect(onClose).toHaveBeenCalledOnce()
    expect(dom.activeElement).toBe(anchor)
  })
})

describe('AttachMenu 목록 갱신 (D-006 · VP-07)', () => {
  it('열린 채 스킬·플러그인·관리 콜백이 바뀌면 메뉴가 새 목록을 그린다', () => {
    const { dom, row, texts, render } = mountMenu({
      skills: [],
      plugins: [],
      onManagePlugins: undefined
    })
    dom.click(row(0, 2))
    expect(texts(1)).toEqual([])
    render({ skills })
    expect(texts(1)).toEqual(['Orcinus orca 스킬', 'CLAUDE 스킬'])
    dom.click(row(0, 3))
    expect(texts(1)).toEqual([])
    render({ plugins })
    expect(texts(1)).toEqual(['Jira DC', 'Confluence'])
    render({ onManagePlugins: vi.fn() })
    expect(texts(1)).toEqual(['Jira DC', 'Confluence', 'chat.composer.attachMenu.managePlugins'])
  })
})
