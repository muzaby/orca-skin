import { useEffect, useRef } from 'react'
import { TweakProvider } from './app/providers/TweakProvider'
import { NavigationProvider, useNavigation } from './app/providers/NavigationProvider'
import { BackendProvider } from './app/providers/BackendProvider'
import { SessionsProvider, useSessionsContext } from './app/providers/SessionsProvider'
import { ProjectsProvider } from './app/providers/ProjectsProvider'
import { ChatProvider, useChatContext } from './app/providers/ChatProvider'
import { AppRouter } from './app/router'
import { Frame, FrameGrid, FrameBody, FrameMain } from './frame/Frame'
import { Header } from './frame/Header'
import { Sidebar } from './frame/Sidebar'
import { ModalLayer } from './frame/ModalLayer'
import { DebugLayer } from './frame/DebugLayer'

// 채팅 턴 완료 → 세션 목록 갱신 크로스-도메인 효과와 Frame 조립.
function AppShell(): React.JSX.Element {
  const { state } = useChatContext()
  const { refresh } = useSessionsContext()
  const { info } = useNavigation()

  const wasInflightRef = useRef(false)
  useEffect(() => {
    if (wasInflightRef.current && !state.inflight) void refresh()
    wasInflightRef.current = state.inflight
  }, [state.inflight, refresh])

  return (
    <Frame label={`Orca · ${info.label}`}>
      <Header breadcrumb={info.breadcrumb} />
      <FrameGrid>
        <FrameBody>
          <Sidebar />
          <FrameMain>
            <AppRouter />
          </FrameMain>
        </FrameBody>
        <ModalLayer />
        <DebugLayer />
      </FrameGrid>
    </Frame>
  )
}

function App(): React.JSX.Element {
  return (
    <TweakProvider>
      <NavigationProvider>
        <BackendProvider>
          <SessionsProvider>
            <ProjectsProvider>
              <ChatProvider>
                <AppShell />
              </ChatProvider>
            </ProjectsProvider>
          </SessionsProvider>
        </BackendProvider>
      </NavigationProvider>
    </TweakProvider>
  )
}

export default App
