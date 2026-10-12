// 0259 r1 verify D2 · VP-06 — AttachMenu 가 메뉴 선택을 갈라 '플러그인 관리'는 주입 콜백을 1회 부르고,
// 나머지는 onAction 으로 넘긴다. 실제 AttachMenu 를 렌더하고 CascadeMenu 가 받은 onSelect 를 직접 부른다.
// r2 verify D4 — '플러그인 관리' 행은 콜백이 주입된 화면에만 그려진다(§10 EP-05 선택적 필드).
// r3 verify D6·D7 — 받은 skills·plugins 를 그대로 트리에 넘긴다(VP-07 path `plugins → buildAttachMenu`).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { SkillInfo } from '../../../../../../shared/ipc'
import type { AttachMenuAction } from '../../lib/attachMenuModel'
import type { PluginMention } from '../../lib/pluginMention'
import type { CascadeItem } from '../../../../shared/ui/cascadeMenuState'

const captured: {
  onSelect?: (action: AttachMenuAction) => void
  items?: CascadeItem<AttachMenuAction>[]
} = {}
vi.mock('../../../../shared/ui/CascadeMenu', () => ({
  CascadeMenu: (props: {
    onSelect: (action: AttachMenuAction) => void
    items: CascadeItem<AttachMenuAction>[]
  }) => {
    captured.onSelect = props.onSelect
    captured.items = props.items
    return null
  }
}))

import { AttachMenu } from './AttachMenu'

function render(
  onManagePlugins?: () => void,
  data: { skills?: readonly SkillInfo[]; plugins?: readonly PluginMention[] } = {}
): {
  onAction: Mock
  select: (action: AttachMenuAction) => void
} {
  const onAction = vi.fn()
  captured.onSelect = undefined
  captured.items = undefined
  renderToStaticMarkup(
    createElement(AttachMenu, {
      open: true,
      anchorRef: { current: null },
      onClose: vi.fn(),
      skills: data.skills ?? [],
      plugins: data.plugins ?? [],
      onAction,
      onManagePlugins
    })
  )
  const select = captured.onSelect as ((action: AttachMenuAction) => void) | undefined
  if (!select) throw new Error('CascadeMenu onSelect not captured')
  return { onAction, select }
}

describe('AttachMenu 선택 라우팅 (AC3 · D2)', () => {
  it("'플러그인 관리'는 주입 콜백을 1회 부르고 onAction 으로 새지 않는다", () => {
    const onManagePlugins = vi.fn()
    const { onAction, select } = render(onManagePlugins)
    select({ type: 'managePlugins' })
    expect(onManagePlugins).toHaveBeenCalledOnce()
    expect(onAction).not.toHaveBeenCalled()
  })

  it.each([
    { type: 'attach' },
    { type: 'skill', name: 'review' },
    { type: 'plugin', id: 'jira' }
  ] as const)('$type 은 onAction 으로 그대로 넘기고 관리 콜백을 부르지 않는다', (action) => {
    const onManagePlugins = vi.fn()
    const { onAction, select } = render(onManagePlugins)
    select(action)
    expect(onAction).toHaveBeenCalledExactlyOnceWith(action)
    expect(onManagePlugins).not.toHaveBeenCalled()
  })
})

function pluginSubmenuKinds(): string[] {
  const plugins = captured.items?.find((item) => item.kind === 'submenu' && item.id === 'plugins')
  if (!plugins || plugins.kind !== 'submenu') throw new Error('plugins submenu not captured')
  return plugins.items.map((item) =>
    item.kind === 'action' ? `${item.kind}:${item.action.type}` : item.kind
  )
}

describe("AttachMenu '플러그인 관리' 행 (AC3 · r2 D4)", () => {
  it('콜백이 주입되면 플러그인 하위 끝에 구분선 + 관리 행을 그린다', () => {
    render(vi.fn())
    expect(pluginSubmenuKinds()).toEqual(['empty', 'separator', 'action:managePlugins'])
  })

  it('콜백이 없으면 관리 행을 그리지 않는다', () => {
    render(undefined)
    expect(pluginSubmenuKinds()).not.toContain('action:managePlugins')
  })
})

function submenuIds(id: 'skills' | 'plugins'): string[] {
  const menu = captured.items?.find((item) => item.kind === 'submenu' && item.id === id)
  if (!menu || menu.kind !== 'submenu') throw new Error(`${id} submenu not captured`)
  return menu.items.flatMap((item) =>
    item.kind === 'submenu' ? [item.id, ...item.items.map((child) => child.id)] : [item.id]
  )
}

describe('AttachMenu 데이터 전달 (AC2·AC3 · r3 D6·D7)', () => {
  it('받은 플러그인·스킬 목록을 그대로 하위 메뉴에 그린다', () => {
    render(vi.fn(), {
      skills: [
        { name: 'review', sourceId: 'orca', sourceLabel: 'Orcinus orca 스킬', description: '' },
        { name: 'plan', sourceId: 'adapter:claude', sourceLabel: 'CLAUDE 스킬', description: '' }
      ] as SkillInfo[],
      plugins: [
        { kind: 'plugin', id: 'jira-dc', label: 'Jira DC' },
        { kind: 'plugin', id: 'confluence', label: 'Confluence' }
      ]
    })
    expect(submenuIds('plugins')).toEqual([
      'plugin:jira-dc',
      'plugin:confluence',
      'plugins:separator',
      'plugins:manage'
    ])
    expect(submenuIds('skills')).toEqual([
      'skills:orca',
      'skill:orca/review',
      'skills:adapter:claude',
      'skill:adapter:claude/plan'
    ])
  })
})
