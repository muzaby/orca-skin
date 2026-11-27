import type { ReactNode } from 'react'
import type { RouteInfo } from '../shared/navigation'

// A route's content enters once per screen family. Parameter changes (including
// active chat sessions) leave the owning layout and its descendants mounted.
export function RouteSurface({
  route,
  children
}: {
  route: RouteInfo
  children: ReactNode
}): React.JSX.Element {
  return (
    <main
      key={route.pattern}
      data-surface-entry=""
      data-context="route-target"
      className="app-frame-main flex min-h-0 min-w-0 flex-1 flex-col"
    >
      {children}
    </main>
  )
}
