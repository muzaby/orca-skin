import { useCallback, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { DEFAULT_ROUTE_INFO, ROUTES, type RouteInfo } from '../shared/navigation'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { OverlayLayer } from './OverlayLayer'
import { AppRouter } from './router'
import { useChatRouteSync } from './hooks/useChatRouteSync'
import { useChatSessionsSync } from './hooks/useChatSessionsSync'
import { useSessionHandlers } from './hooks/useSessionHandlers'
import { useSidebarSlots } from './hooks/useSidebarSlots'

// 셸 조립 진입점. App.tsx 의 Provider 합성 직하에서 호출되며, 라우팅에 무관한
// 고정 골격 (Header + Sidebar + main + OverlayLayer) 을 한 곳에서 직접 조립한다.
// cross-feature wiring (chat→sessions 동기화, 세션 핸들러 합성, slot 안정화) 은
// app/hooks/ 의 hook 으로 위임 — AppLayout 본체는 조립만 한다.
export function AppLayout(): React.JSX.Element {
  const { pathname } = useLocation()
  const info = matchRouteInfo(pathname)

  useChatRouteSync()
  useChatSessionsSync()
  const handlers = useSessionHandlers()
  const slots = useSidebarSlots(handlers)

  // 대화 검색 모달은 셸 단일 인스턴스 — 열기는 Header, 렌더는 OverlayLayer 한 곳.
  // 두 노드 모두 app/ 셸 레이어 안에 있으므로 Context 없이 useState 로 lift.
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={`Orca · ${info.label}`}
    >
      <Header onOpenSearch={openSearch} />
      <div className="app-frame-grid relative grid min-h-0 flex-1 grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]">
        <div className="app-frame-body z-0 flex min-h-0 min-w-0">
          <Sidebar {...slots} />
          <main
            className="app-frame-main flex min-h-0 min-w-0 flex-1 flex-col"
            data-context="route-target"
          >
            <AppRouter />
          </main>
        </div>
        <OverlayLayer searchOpen={searchOpen} onCloseSearch={closeSearch} />
      </div>
    </div>
  )
}

function matchRouteInfo(pathname: string): RouteInfo {
  for (const r of ROUTES) {
    if (matchPath(r.pattern, pathname)) return r
  }
  return DEFAULT_ROUTE_INFO
}
