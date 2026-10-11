import { BrowserRouter } from 'react-router-dom'
import { TweakProvider } from './shared/theme'
import { BackendProvider } from './features/backend'
import { SessionsProvider } from './features/sessions'
import { ChatProvider } from './features/chat'
import { CostProvider } from './features/cost'
import { UpdateProvider } from './features/update'
import { ErrorToastLayer } from './app/ErrorToastLayer'
import { RootGate } from './app/RootGate'
import { TooltipHost } from './shared/ui/TooltipHost'

function App(): React.JSX.Element {
  return (
    <TweakProvider>
      <BrowserRouter>
        <BackendProvider>
          <SessionsProvider>
            <CostProvider>
              <UpdateProvider>
                <ChatProvider>
                  <RootGate />
                  <ErrorToastLayer />
                  {/* 0257 — 모든 title 툴팁을 검은 툴팁으로(게이트·부팅 화면 포함). */}
                  <TooltipHost />
                </ChatProvider>
              </UpdateProvider>
            </CostProvider>
          </SessionsProvider>
        </BackendProvider>
      </BrowserRouter>
    </TweakProvider>
  )
}

export default App
