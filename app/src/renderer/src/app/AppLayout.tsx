import { useEffect, useRef } from 'react'
import { useNavigation } from './providers/NavigationProvider'
import { useChatContext } from './providers/ChatProvider'
import { useSessionsContext } from './providers/SessionsProvider'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { OverlayLayer } from './OverlayLayer'
import { AppRouter } from './router'
import { NewChatButton } from '../features/chat'
import { SessionList } from '../features/sessions'
import { BackendStatus } from '../features/backend'

// 셸 조립 진입점. App.tsx 의 Provider 합성 직하에서 호출되며, 라우팅에 무관한
// 고정 골격 (Header + Sidebar + main + OverlayLayer) 을 한 곳에서 직접 조립한다.
// `AppShell`, `FrameGrid`, `FrameBody` 같은 중간 wrapper 로 숨기지 않는다 — §3.A.
export function AppLayout(): React.JSX.Element {
  const { state } = useChatContext()
  const { refresh } = useSessionsContext()
  const { info } = useNavigation()

  // 채팅 턴 완료 시 사이드바 세션 목록 자동 갱신 — cross-domain effect 라 셸이 호스트.
  const wasInflightRef = useRef(false)
  useEffect(() => {
    if (wasInflightRef.current && !state.inflight) void refresh()
    wasInflightRef.current = state.inflight
  }, [state.inflight, refresh])

  return (
    <div
      className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-[13px] leading-[1.45] text-ink"
      data-screen-label={`Orca · ${info.label}`}
    >
      <Header breadcrumb={info.breadcrumb} />
      <div className="app-frame-grid relative grid min-h-0 flex-1 grid-cols-1 grid-rows-1 [&>*]:[grid-area:1/1]">
        <div className="app-frame-body z-0 flex min-h-0 min-w-0">
          <Sidebar
            newChatSlot={<NewChatButton />}
            sessionsSlot={<SessionList />}
            footerSlot={<BackendStatus />}
          />
          <main className="app-frame-main min-h-0 flex-1" data-context="route-target">
            <AppRouter />
          </main>
        </div>
        <OverlayLayer />
      </div>
    </div>
  )
}
