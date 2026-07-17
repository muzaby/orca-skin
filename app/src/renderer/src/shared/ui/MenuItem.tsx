import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Popover/드롭다운 메뉴 항목 표준 (handoff 0121).
 *
 * 파일마다 재정의되던 로컬 MENU_ITEM/DANGER_MENU_ITEM 상수를 단일화한다.
 * 상태 정책은 공용 Button 과 동일: cursor-default · hide-focus-ring ring-focus ·
 * disabled:opacity-50. danger 는 파괴적 항목(삭제 등)의 rust 톤.
 */

const BASE =
  'flex w-full cursor-default select-none gap-2 rounded-r4 border-0 bg-transparent px-2.5 py-1.5 text-left text-footnote outline-none hide-focus-ring ring-focus transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  danger?: boolean
  /** 라벨 앞 글리프. */
  icon?: IconName
  iconSize?: number
  /** 2줄(라벨+설명) 항목은 'start' — 글리프/내용을 상단 정렬한다. 기본 'center'. */
  align?: 'center' | 'start'
  children?: ReactNode
}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem(
  {
    danger = false,
    icon,
    iconSize = 14,
    align = 'center',
    children,
    className = '',
    type = 'button',
    ...rest
  },
  ref
) {
  const tone = danger
    ? 'text-rust enabled:hover:bg-rust-soft'
    : 'text-t8 enabled:hover:bg-fill-uncontained-hover'
  const alignClass = align === 'start' ? 'items-start' : 'items-center'
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${alignClass} ${tone} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} className="shrink-0" />}
      {children}
    </button>
  )
})
