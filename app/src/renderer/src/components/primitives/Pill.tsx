import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type PillSurface = 'solid' | 'ghost'
export type PillTone = 'default' | 'good' | 'warn' | 'info' | 'rust'

export interface PillProps {
  icon?: IconName
  label: ReactNode
  dropdown?: boolean
  surface?: PillSurface
  tone?: PillTone
  selected?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  title?: string
  style?: CSSProperties
}

/** Pill / chip — used under the composer (project/role/model) and as a status chip
 *  in scheduled items / suggestion entries. Tone maps to design tokens; raw colors
 *  are never passed in. */
export function Pill({
  icon,
  label,
  dropdown,
  surface = 'solid',
  tone = 'default',
  selected,
  onClick,
  title,
  style
}: PillProps): React.JSX.Element {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 11px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    wordBreak: 'keep-all',
    ...TONE_STYLE[tone],
    ...(surface === 'ghost'
      ? { background: 'transparent', color: tone === 'default' ? 'var(--ink-2)' : TONE_STYLE[tone].color }
      : {}),
    ...(selected
      ? { background: 'var(--press)', color: 'var(--ink)' }
      : {}),
    ...style
  }
  return (
    <button onClick={onClick} title={title} className="pill-btn" style={base}>
      {icon && <Icon name={icon} size={14} color={base.color ?? 'var(--ink-3)'} />}
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      {dropdown && <Icon name="chevronD" size={12} color="var(--ink-4)" />}
    </button>
  )
}

const TONE_STYLE: Record<PillTone, { background: string; color: string }> = {
  default: { background: 'rgba(0,0,0,.035)', color: 'var(--ink-2)' },
  good: { background: 'rgba(94,158,92,.16)', color: '#3a6e3a' },
  warn: { background: 'rgba(199,148,49,.16)', color: '#8a6520' },
  info: { background: 'rgba(58,109,181,.14)', color: 'var(--info)' },
  rust: { background: 'var(--rust-soft)', color: 'var(--rust-ink)' }
}
