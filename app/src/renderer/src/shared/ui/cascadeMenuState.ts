// 계단식 메뉴 상태 — 순수부(0259 D-007·D-008·D-011). 도메인(스킬·플러그인)을 모른다.
import type { IconName } from './Icon'
import type { StatusTone } from './Status'

export type CascadeItem<A> =
  | {
      kind: 'action'
      id: string
      label: string
      icon?: IconName
      /** hover 설명 — 0257 TooltipHost 가 검은 툴팁으로 그린다. */
      title?: string
      disabled?: boolean
      checked?: boolean
      description?: string
      action: A
      status?: { tone: StatusTone; label: string }
      /** Independent control alongside the main action (e.g. open vs enable). */
      secondary?: { label: string; checked: boolean; disabled?: boolean; busy?: boolean; action: A }
    }
  | {
      kind: 'submenu'
      id: string
      label: string
      icon?: IconName
      disabled?: boolean
      items: CascadeItem<A>[]
    }
  | { kind: 'separator'; id: string }
  | { kind: 'empty'; id: string; label: string }

/** 하위 메뉴 hover 열림 지연(ms). */
export const HOVER_OPEN_DELAY_MS = 150
/** 부모 항목과 하위 패널 사이 간격 · 화면 가장자리 여유(px). */
export const SUBMENU_GAP = 4
export const SUBMENU_EDGE = 8

export interface CascadeState {
  /** 레벨별로 열린 하위 메뉴 항목 인덱스. open[0] = 최상위에서 연 항목. */
  open: number[]
  /** 키보드 포커스. null = 아직 키보드로 들어오지 않음. */
  focus: { level: number; index: number } | null
}

export const INITIAL_CASCADE_STATE: CascadeState = { open: [], focus: null }

export type CascadeEvent =
  | { type: 'key'; key: string }
  | { type: 'hover'; level: number; index: number }
  | { type: 'click'; level: number; index: number }

export type CascadeEffect<A> = { type: 'activate'; action: A } | { type: 'close' } | null

/** 레벨 L 패널의 항목 — 열린 경로를 따라 내려간다. */
export function panelItems<A>(
  items: readonly CascadeItem<A>[],
  open: readonly number[],
  level: number
): readonly CascadeItem<A>[] {
  let current = items
  for (let l = 0; l < level; l++) {
    const item = current[open[l]]
    if (!item || item.kind !== 'submenu' || item.disabled) return []
    current = item.items
  }
  return current
}

function focusable<A>(item: CascadeItem<A> | undefined): boolean {
  return (
    !!item && (item.kind === 'submenu' ? !item.disabled : item.kind === 'action' && !item.disabled)
  )
}

function step<A>(list: readonly CascadeItem<A>[], from: number, delta: 1 | -1): number {
  const n = list.length
  for (let i = 1; i <= n; i++) {
    const index = (((from + delta * i) % n) + n) % n
    if (focusable(list[index])) return index
  }
  return -1
}

function firstFocusable<A>(list: readonly CascadeItem<A>[]): number {
  return list.findIndex((item) => focusable(item))
}

function openAt<A>(
  items: readonly CascadeItem<A>[],
  state: CascadeState,
  level: number,
  index: number,
  focusChild: boolean
): { state: CascadeState; effect: CascadeEffect<A> } {
  const open = [...state.open.slice(0, level), index]
  const child = panelItems(items, open, level + 1)
  const first = firstFocusable(child)
  return {
    state: {
      open,
      focus: focusChild && first >= 0 ? { level: level + 1, index: first } : state.focus
    },
    effect: null
  }
}

export function reduceCascade<A>(
  items: readonly CascadeItem<A>[],
  state: CascadeState,
  event: CascadeEvent
): { state: CascadeState; effect: CascadeEffect<A> } {
  if (event.type === 'hover') {
    const item = panelItems(items, state.open, event.level)[event.index]
    if (item?.kind === 'submenu' && !item.disabled)
      return openAt(items, state, event.level, event.index, false)
    // 동작 항목 위 hover — 그 레벨 아래의 열린 하위 메뉴를 닫는다(형제 하위 닫힘).
    return { state: { ...state, open: state.open.slice(0, event.level) }, effect: null }
  }
  if (event.type === 'click') {
    const item = panelItems(items, state.open, event.level)[event.index]
    if (item?.kind === 'submenu' && !item.disabled)
      return openAt(items, state, event.level, event.index, false)
    if (item?.kind === 'action' && !item.disabled)
      return { state, effect: { type: 'activate', action: item.action } }
    return { state, effect: null }
  }

  const { key } = event
  if (!state.focus) {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const first = firstFocusable(items)
      return {
        state: { ...state, focus: first >= 0 ? { level: 0, index: first } : null },
        effect: null
      }
    }
    if (key === 'Escape') return { state, effect: { type: 'close' } }
    return { state, effect: null }
  }
  const { level, index } = state.focus
  const list = panelItems(items, state.open, level)
  const item = list[index]
  switch (key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const next = step(list, index, key === 'ArrowDown' ? 1 : -1)
      return {
        state: {
          open: state.open.slice(0, level),
          focus: next >= 0 ? { level, index: next } : state.focus
        },
        effect: null
      }
    }
    case 'ArrowRight':
    case 'Enter':
    case ' ':
      if (item?.kind === 'submenu' && !item.disabled)
        return openAt(items, state, level, index, true)
      if (key !== 'ArrowRight' && item?.kind === 'action' && !item.disabled)
        return { state, effect: { type: 'activate', action: item.action } }
      return { state, effect: null }
    case 'ArrowLeft':
    case 'Escape':
      if (level === 0)
        return key === 'Escape' ? { state, effect: { type: 'close' } } : { state, effect: null }
      return {
        state: {
          open: state.open.slice(0, level - 1),
          focus: { level: level - 1, index: state.open[level - 1] }
        },
        effect: null
      }
    default:
      return { state, effect: null }
  }
}

/** 하위 패널 좌표(0259 D-008) — 부모 항목 오른쪽, 넘치면 왼쪽, 아래가 모자라면 위로 민다. */
export function submenuPosition(input: {
  itemRect: { left: number; right: number; top: number }
  size: { width: number; height: number }
  viewport: { width: number; height: number }
}): { left: number; top: number; maxHeight: number } {
  const { itemRect, size, viewport } = input
  const maxHeight = viewport.height - SUBMENU_EDGE * 2
  const height = Math.min(size.height, maxHeight)
  let left = itemRect.right + SUBMENU_GAP
  if (left + size.width > viewport.width - SUBMENU_EDGE)
    left = itemRect.left - SUBMENU_GAP - size.width
  left = Math.max(SUBMENU_EDGE, left)
  let top = itemRect.top - SUBMENU_GAP
  if (top + height > viewport.height - SUBMENU_EDGE) top = viewport.height - SUBMENU_EDGE - height
  top = Math.max(SUBMENU_EDGE, top)
  return { left, top, maxHeight }
}
