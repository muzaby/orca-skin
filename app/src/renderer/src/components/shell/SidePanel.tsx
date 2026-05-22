import type { CSSProperties, ReactNode } from 'react'

export type SidePanelSide = 'left' | 'right'
export type SidePanelSurface = 'bg' | 'bg-2' | 'paper'

export interface SidePanelProps {
  side: SidePanelSide
  /** Width in px. Defaults: left=248 (--sidebar-w), right=320 (--right-pane-w). */
  width?: number
  surface?: SidePanelSurface
  /** Optional header / footer slots — both flex children, no inherent padding. */
  header?: ReactNode
  footer?: ReactNode
  /** Body. Use scroll container inside if list is long. */
  children?: ReactNode
  style?: CSSProperties
  className?: string
}

/** SidePanel — common shell for Sidebar (left 248), RightPanel (right 320),
 *  ArtifactPanel (right 620), Settings tab rail (left 200). Vertical flex,
 *  header / body / footer slots. Internal content is fully composed by parent. */
export function SidePanel({
  side,
  width,
  surface = side === 'left' ? 'bg-2' : 'bg',
  header,
  footer,
  children,
  style,
  className
}: SidePanelProps): React.JSX.Element {
  const w = width ?? (side === 'left' ? 'var(--sidebar-w)' : 'var(--right-pane-w)')
  const border =
    side === 'left'
      ? undefined
      : `1px solid ${surface === 'paper' ? 'var(--line)' : 'transparent'}`
  return (
    <aside
      className={className}
      style={{
        width: w,
        flex: '0 0 auto',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: SURFACE[surface],
        borderLeft: side === 'right' ? border : undefined,
        borderRight: side === 'left' && surface === 'paper' ? '1px solid var(--line)' : undefined,
        ...style
      }}
    >
      {header}
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
      {footer}
    </aside>
  )
}

const SURFACE: Record<SidePanelSurface, string> = {
  bg: 'var(--bg)',
  'bg-2': 'var(--bg-2)',
  paper: 'var(--paper)'
}
