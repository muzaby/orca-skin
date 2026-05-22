import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export interface NavItemProps {
  icon?: IconName
  iconSize?: number
  label: ReactNode
  /** Stronger weight for primary actions (e.g. "New task"). */
  primary?: boolean
  active?: boolean
  /** Trailing slot — badge ("베타"), kbd hint ("Ctrl,"), or chevron (submenu). */
  trailing?: ReactNode
  /** Indent for sub-rows. Default 10px horizontal padding; pass {x, y} to override. */
  padding?: { x?: number; y?: number }
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  title?: string
  style?: CSSProperties
}

/** NavItem — one row in any nav list (Sidebar nav, AccountMenu MenuRow,
 *  Settings tabs, LanguageSubmenu). Hover handled by .sb-nav-btn (app.css). */
export function NavItem({
  icon,
  iconSize = 16,
  label,
  primary,
  active,
  trailing,
  padding,
  onClick,
  title,
  style
}: NavItemProps): React.JSX.Element {
  const px = padding?.x ?? 10
  const py = padding?.y ?? 7
  const color = active ? 'var(--ink)' : 'var(--ink-2)'
  const iconColor = active ? 'var(--ink)' : primary ? 'var(--ink-2)' : 'var(--ink-3)'
  return (
    <button
      onClick={onClick}
      title={title}
      className="sb-nav-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: `${py}px ${px}px`,
        borderRadius: 7,
        background: active ? 'var(--press)' : 'transparent',
        color,
        fontSize: 13.5,
        fontWeight: active || primary ? 600 : 500,
        textAlign: 'left',
        ...style
      }}
    >
      {icon && <Icon name={icon} size={iconSize} color={iconColor} />}
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {trailing}
    </button>
  )
}

/** Small badge for trailing slot ("베타", "Ctrl,"). */
export function NavBadge({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        padding: '1px 6px',
        background: 'rgba(0,0,0,.06)',
        borderRadius: 4,
        color: 'var(--ink-3)',
        letterSpacing: 0.3
      }}
    >
      {children}
    </span>
  )
}
