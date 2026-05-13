import type { ReactNode } from 'react'

export interface FrameProps {
  children: ReactNode
  label?: string
}

export function Frame({ children, label }: FrameProps): React.JSX.Element {
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={label}
    >
      {children}
    </div>
  )
}
