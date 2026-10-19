import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Icon } from './Icon'
import { MenuItem } from './MenuItem'
import { Popover } from './Popover'
import {
  HOVER_OPEN_DELAY_MS,
  INITIAL_CASCADE_STATE,
  panelItems,
  reduceCascade,
  submenuPosition,
  type CascadeEvent,
  type CascadeItem,
  type CascadeState
} from './cascadeMenuState'

// 계단식 메뉴(0259 D-007·D-008·D-011) — 도메인 무관. 최상위 패널은 Popover 가 배치·바깥 클릭·Esc 를
// 맡고, 하위 패널은 최상위 패널 DOM 안에 `position:fixed` 로 그린다 — Popover 의 `contains` 판정이
// 하위 패널 클릭을 안쪽으로 본다. 열린 경로·포커스 규칙은 순수 reducer(cascadeMenuState.ts)가 갖는다.
interface CascadeMenuProps<A> {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  items: CascadeItem<A>[]
  onSelect: (action: A) => void
  placement?: 'top' | 'bottom'
  ariaLabel?: string
}

export function CascadeMenu<A>({
  open,
  anchorRef,
  onClose,
  items,
  onSelect,
  placement,
  ariaLabel
}: CascadeMenuProps<A>): React.JSX.Element | null {
  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} placement={placement}>
      {/* 닫히면 Popover 가 내용을 언마운트한다 — 다시 열면 상태가 처음부터다. */}
      <CascadeBody
        items={items}
        onSelect={onSelect}
        onClose={onClose}
        anchorRef={anchorRef}
        ariaLabel={ariaLabel}
      />
    </Popover>
  )
}

const HANDLED_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  ' ',
  'Escape'
])

// export = 렌더 테스트가 열린 상태(하위 패널이 루트 안에 그려지는가)를 직접 그린다.
export function CascadeBody<A>({
  items,
  onSelect,
  onClose,
  anchorRef,
  ariaLabel,
  autoFocus = true,
  closeOnSelect = true,
  initialState = INITIAL_CASCADE_STATE
}: {
  items: CascadeItem<A>[]
  onSelect: (action: A) => void
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  ariaLabel?: string
  autoFocus?: boolean
  closeOnSelect?: boolean
  initialState?: CascadeState
}): React.JSX.Element {
  const [state, setState] = useState<CascadeState>(initialState)
  const stateRef = useRef(state)
  const rootRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | null>(null)

  const dispatch = (event: CascadeEvent): void => {
    const { state: next, effect } = reduceCascade(items, stateRef.current, event)
    stateRef.current = next
    setState(next)
    if (effect?.type === 'activate') {
      onSelect(effect.action)
      if (closeOnSelect) onClose()
    } else if (effect?.type === 'close') {
      onClose()
      anchorRef.current?.focus()
    }
  }

  const cancelHover = (): void => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }
  const scheduleHover = (level: number, index: number): void => {
    cancelHover()
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null
      dispatch({ type: 'hover', level, index })
    }, HOVER_OPEN_DELAY_MS)
  }

  // 패널은 배치를 재기 전 첫 커밋에서 visibility:hidden 이다(Popover 루트·하위 패널 모두). 숨은 요소는
  // 포커스를 받지 않으므로(Chromium) 배치 재렌더가 끝난 다음 프레임에 옮긴다 — 열 때 루트, 키 이동 때 그 행.
  const focusNextFrame = (target: () => HTMLElement | null | undefined): (() => void) => {
    const frame = window.requestAnimationFrame(() => target()?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }

  useEffect(() => {
    const cancelFocus = autoFocus ? focusNextFrame(() => rootRef.current) : () => {}
    return () => {
      cancelFocus()
      cancelHover()
    }
  }, [autoFocus])

  useEffect(() => {
    const focus = state.focus
    if (!focus) return
    return focusNextFrame(() =>
      rootRef.current?.querySelector<HTMLElement>(
        `[data-cascade-level="${focus.level}"][data-cascade-index="${focus.index}"]`
      )
    )
  }, [state.focus])

  const levels = [0, ...state.open.map((_, i) => i + 1)]
  return (
    <div
      ref={rootRef}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={autoFocus ? -1 : 0}
      className="outline-none"
      onKeyDown={(event) => {
        if (!HANDLED_KEYS.has(event.key)) return
        event.preventDefault()
        // Esc 는 한 단계만 닫는다 — Popover 의 문서 keydown 이 메뉴 전체를 닫지 않게 막는다.
        event.stopPropagation()
        dispatch({ type: 'key', key: event.key })
      }}
    >
      {levels.map((level) => (
        <CascadePanel
          key={level}
          level={level}
          items={panelItems(items, state.open, level)}
          openIndex={state.open[level]}
          parentIndex={level > 0 ? state.open[level - 1] : undefined}
          rootRef={rootRef}
          onHover={scheduleHover}
          onLeave={cancelHover}
          onClick={(index) => {
            cancelHover()
            dispatch({ type: 'click', level, index })
          }}
        />
      ))}
    </div>
  )
}

function CascadePanel<A>({
  level,
  items,
  openIndex,
  parentIndex,
  rootRef,
  onHover,
  onLeave,
  onClick
}: {
  level: number
  items: readonly CascadeItem<A>[]
  openIndex: number | undefined
  parentIndex: number | undefined
  rootRef: RefObject<HTMLDivElement | null>
  onHover: (level: number, index: number) => void
  onLeave: () => void
  onClick: (index: number) => void
}): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    if (level === 0) return
    const parent = rootRef.current?.querySelector<HTMLElement>(
      `[data-cascade-level="${level - 1}"][data-cascade-index="${parentIndex}"]`
    )
    const panel = panelRef.current
    if (!parent || !panel) return
    setPos(
      submenuPosition({
        itemRect: parent.getBoundingClientRect(),
        size: { width: panel.offsetWidth, height: panel.scrollHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight }
      })
    )
  }, [level, parentIndex, rootRef, items])

  const body = (
    <div className="flex min-w-[200px] flex-col">
      {items.map((item, index) => {
        if (item.kind === 'separator')
          return <div key={item.id} role="separator" className="mx-1 my-1 h-px bg-border" />
        if (item.kind === 'empty')
          return (
            <div key={item.id} aria-disabled className="px-2.5 py-1.5 text-footnote text-ink3">
              {item.label}
            </div>
          )
        const submenu = item.kind === 'submenu'
        const expanded = submenu && openIndex === index
        return (
          <MenuItem
            key={item.id}
            role={
              item.kind === 'action' && item.checked !== undefined ? 'menuitemcheckbox' : 'menuitem'
            }
            aria-checked={item.kind === 'action' ? item.checked : undefined}
            icon={item.icon}
            iconSize={13}
            tabIndex={-1}
            title={item.kind === 'action' ? item.title : undefined}
            disabled={item.kind === 'action' && item.disabled}
            aria-haspopup={submenu ? 'menu' : undefined}
            aria-expanded={submenu ? expanded : undefined}
            data-cascade-level={level}
            data-cascade-index={index}
            className={expanded ? 'bg-fill-uncontained-hover' : ''}
            onPointerEnter={() => onHover(level, index)}
            onPointerLeave={onLeave}
            onClick={() => onClick(index)}
          >
            <span className="min-w-0 flex-1 truncate">
              <span>{item.label}</span>
              {item.kind === 'action' && item.description && (
                <span className="block text-caption text-ink3">{item.description}</span>
              )}
            </span>
            {item.kind === 'action' && item.checked !== undefined && (
              <span
                aria-hidden="true"
                className={`ml-3 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 ${item.checked ? 'justify-end bg-toggle-on' : 'justify-start bg-border-strong'}`}
              >
                <span className="size-3 rounded-full bg-white" />
              </span>
            )}
            {submenu && <Icon name="chevR" size={12} className="shrink-0 text-ink3" />}
          </MenuItem>
        )
      })}
    </div>
  )

  if (level === 0) return body
  return (
    <div
      ref={panelRef}
      role="menu"
      className="app-frame-floating fixed z-50 overflow-y-auto rounded-lg border border-border bg-panel p-1 shadow-lg"
      style={
        pos
          ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
          : { left: 0, top: 0, visibility: 'hidden' }
      }
    >
      {body}
    </div>
  )
}
