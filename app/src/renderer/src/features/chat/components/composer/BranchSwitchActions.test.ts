// D-004 / AC6 — **메뉴에서 방식을 고르는 것만으로는 아무것도 실행되지 않는다.**
//
// `변경 사항 취소`(reset --hard)가 한 번의 오클릭으로 날아가지 않게 하는 것이 이 분리의
// 목적이라, 잠가야 하는 것은 "선택 핸들러가 무엇을 부르는가" 라는 **배선** 이다. 값이 아니라
// 배선이므로 순수 함수 단언으로는 잡히지 않는다.
//
// `BranchSwitchActions` 는 훅을 쓰지 않으므로 렌더 하네스 없이 그대로 호출해 반환된 엘리먼트
// 트리를 훑을 수 있다 — 여기서 보는 onClick 은 실제 프로덕션이 DOM 에 붙이는 그 핸들러다.

import { describe, expect, it, vi } from 'vitest'
import type { GitDirtyResolution } from '../../../../../../shared/ipc'
import { BranchSwitchActions } from './BranchSwitchActions'

interface ElementLike {
  props: Record<string, unknown>
}

function flatten(node: unknown, out: ElementLike[] = []): ElementLike[] {
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out)
    return out
  }
  if (node == null || typeof node !== 'object') return out
  const element = node as Partial<ElementLike>
  if (element.props == null || typeof element.props !== 'object') return out
  out.push(element as ElementLike)
  flatten((element.props as { children?: unknown }).children, out)
  return out
}

const OPTIONS = [
  { value: 'stash' as const, label: '변경 사항 스태시' },
  { value: 'commit-wip' as const, label: 'WIP으로 커밋' },
  { value: 'discard' as const, label: '변경 사항 취소' }
]

function render(resolution: GitDirtyResolution = 'stash'): {
  nodes: ElementLike[]
  onConfirm: ReturnType<typeof vi.fn>
  onSelect: ReturnType<typeof vi.fn>
  onCancel: ReturnType<typeof vi.fn>
} {
  const onConfirm = vi.fn()
  const onSelect = vi.fn()
  const onCancel = vi.fn()
  const tree = BranchSwitchActions({
    options: OPTIONS,
    resolution,
    menuOpen: true,
    busy: false,
    cancelLabel: '취소',
    menuAriaLabel: '변경 사항 처리 방식',
    menuButtonRef: { current: null },
    onCancel,
    onSelect,
    onToggleMenu: vi.fn(),
    onCloseMenu: vi.fn(),
    onConfirm
  })
  return { nodes: flatten(tree), onConfirm, onSelect, onCancel }
}

const menuItems = (nodes: ElementLike[]): ElementLike[] =>
  nodes.filter((node) => node.props.role === 'menuitemradio')

const confirmButton = (nodes: ElementLike[]): ElementLike =>
  nodes.filter((node) => node.props['data-action'] === 'dirty-confirm')[0]

describe('BranchSwitchActions — 메뉴는 선택만, 실행은 왼쪽 버튼 (AC6)', () => {
  it('메뉴 항목 3개가 순서대로 있고 현재 선택에 aria-checked 가 붙는다', () => {
    const items = menuItems(render('commit-wip').nodes)

    expect(items).toHaveLength(3)
    expect(items.map((item) => item.props['aria-checked'])).toEqual([false, true, false])
  })

  it('메뉴 항목을 전부 눌러도 onConfirm 호출은 0회다', () => {
    const { nodes, onConfirm, onSelect } = render()

    for (const item of menuItems(nodes)) {
      ;(item.props.onClick as () => void)()
    }

    expect(onConfirm).toHaveBeenCalledTimes(0)
    // 선택은 이동했다 — 아무 배선도 없는 것이 아니라 실행만 없는 것이다.
    expect(onSelect.mock.calls.map((call) => call[0])).toEqual(['stash', 'commit-wip', 'discard'])
  })

  it('왼쪽 버튼을 누르면 현재 선택으로 onConfirm 이 1회 호출된다', () => {
    const { nodes, onConfirm } = render('discard')
    ;(confirmButton(nodes).props.onClick as () => void)()

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('discard')
  })

  it('왼쪽 버튼 라벨이 현재 선택의 라벨이다 — 무엇이 실행될지 버튼에 쓰여 있다', () => {
    const { nodes } = render('discard')

    expect(confirmButton(nodes).props.children).toBe('변경 사항 취소')
  })

  it('취소 버튼은 onCancel 만 부른다', () => {
    const { nodes, onConfirm, onCancel } = render()
    const cancel = nodes.filter((node) => node.props.children === '취소')[0]
    ;(cancel.props.onClick as () => void)()

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(0)
  })

  it('기본 선택은 첫 항목(스태시)이다 — 파괴적 항목이 기본이 아니다', () => {
    expect(OPTIONS[0].value).toBe('stash')
    const { nodes } = render()
    expect(confirmButton(nodes).props.children).toBe('변경 사항 스태시')
  })
})
