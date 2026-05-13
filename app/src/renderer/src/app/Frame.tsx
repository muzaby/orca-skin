import type { ReactNode } from 'react'
import { V1 } from './theme'

export interface FrameProps {
  children: ReactNode
  label?: string
}

export function Frame({ children, label }: FrameProps): React.JSX.Element {
  return (
    <div
      className="app-frame"
      style={{ background: V1.bg, fontFamily: 'var(--sans)' }}
      data-screen-label={label}
    >
      {children}
    </div>
  )
}
