import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

export type CardSurface = 'paper' | 'paper-2'
export type CardElevation = 'none' | 'sm' | 'md'
export type CardRadius = 'sm' | 'md' | 'lg' | 'xl'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  surface?: CardSurface
  bordered?: boolean
  elevation?: CardElevation
  radius?: CardRadius
  /** Inline padding. Number for uniform, [v, h] for separate. */
  padding?: number | [number, number]
  children?: ReactNode
}

/** Card — single surface primitive that covers every v5 card variant
 *  (ToolBlock, Bash, ApprovalCard, ScheduleCard, DocCard, FolderChartCard,
 *  home suggestion cards). All variant props map to design tokens; no arbitrary
 *  colors / shadows allowed. */
export function Card({
  surface = 'paper',
  bordered = false,
  elevation = 'none',
  radius = 'md',
  padding,
  children,
  style,
  ...rest
}: CardProps): React.JSX.Element {
  const pad: CSSProperties = {}
  if (typeof padding === 'number') pad.padding = padding
  else if (Array.isArray(padding)) pad.padding = `${padding[0]}px ${padding[1]}px`

  return (
    <div
      {...rest}
      style={{
        background: SURFACE[surface],
        border: bordered ? '1px solid var(--line)' : 'none',
        borderRadius: RADIUS[radius],
        boxShadow: SHADOW[elevation],
        ...pad,
        ...style
      }}
    >
      {children}
    </div>
  )
}

const SURFACE: Record<CardSurface, string> = {
  paper: 'var(--paper)',
  'paper-2': 'var(--paper-2)'
}

const RADIUS: Record<CardRadius, string> = {
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)'
}

const SHADOW: Record<CardElevation, string | undefined> = {
  none: undefined,
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)'
}
