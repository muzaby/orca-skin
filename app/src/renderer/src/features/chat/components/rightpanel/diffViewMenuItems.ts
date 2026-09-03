import type { MessageKey } from '../../../../shared/i18n'
import type { DiffViewOptions } from '../../reducer/chatReducer'

// `⋮` 메뉴의 **일곱 항목과 그 순서** (0211 ΔV5 D-106 · §10 EP-33).
//
// ΔV4 의 여덟에서 `새로고침` 이 빠졌다 — D-099 가 수동 새로고침 계기 자체를 없앴으므로
// 항목을 남기면 누를 것 없는 줄이 메뉴에 남는다.
//
// 목록을 컴포넌트 밖에 두는 이유: 항목을 하나씩 `toContain` 으로 세면 하나를 지운 변이가
// 나머지 여섯으로 통과한다(AT-35 와 같은 축). 배열 자체를 비교해야 누락이 red 가 된다.
//
// Git 조작(stage·commit·push)은 없다 — 이 패널은 읽기 전용 review surface 다(제안서 §18).

export type DiffViewMenuAction =
  | { kind: 'sidebar' }
  | { kind: 'collapse-all' }
  | { kind: 'expand-all' }
  | { kind: 'view'; option: keyof DiffViewOptions }

export interface DiffViewMenuItem {
  id: string
  labelKey: MessageKey
  action: DiffViewMenuAction
  /** 체크 표시가 붙는 항목인가 — 켬/끔 상태를 가진 것만 true 다. */
  checkable: boolean
}

export const DIFF_VIEW_MENU_ITEMS: readonly DiffViewMenuItem[] = [
  {
    id: 'files',
    labelKey: 'chat.rightpanel.diffFilesOn',
    action: { kind: 'sidebar' },
    checkable: true
  },
  {
    id: 'collapse-all',
    labelKey: 'chat.rightpanel.diffCollapseAll',
    action: { kind: 'collapse-all' },
    checkable: false
  },
  {
    id: 'expand-all',
    labelKey: 'chat.rightpanel.diffExpandAll',
    action: { kind: 'expand-all' },
    checkable: false
  },
  {
    id: 'side-by-side',
    labelKey: 'chat.rightpanel.diffSideBySide',
    action: { kind: 'view', option: 'layout' },
    checkable: true
  },
  {
    id: 'wrap',
    labelKey: 'chat.rightpanel.diffWrapLines',
    action: { kind: 'view', option: 'wrapLines' },
    checkable: true
  },
  {
    id: 'highlight',
    labelKey: 'chat.rightpanel.diffHighlightWords',
    action: { kind: 'view', option: 'highlightWords' },
    checkable: true
  },
  {
    id: 'whitespace',
    labelKey: 'chat.rightpanel.diffIgnoreWhitespace',
    action: { kind: 'view', option: 'ignoreWhitespace' },
    checkable: true
  }
]

/** 지금 그 항목에 체크가 붙는가 — 표시 옵션 넷과 사이드바가 각자 다른 축을 본다. */
export function diffViewMenuChecked(
  item: DiffViewMenuItem,
  view: DiffViewOptions,
  sidebarVisible: boolean
): boolean {
  if (item.action.kind === 'sidebar') return sidebarVisible
  if (item.action.kind !== 'view') return false
  if (item.action.option === 'layout') return view.layout === 'side-by-side'
  return view[item.action.option] === true
}
