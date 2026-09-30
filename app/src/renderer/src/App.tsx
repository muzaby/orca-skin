import { BrowserRouter } from 'react-router-dom'
import { TweakProvider } from './shared/theme'
import { BackendProvider } from './features/backend'
import { SessionsProvider } from './features/sessions'
import { ChatProvider } from './features/chat'
import { CostProvider } from './features/cost'
import { UpdateProvider } from './features/update'
import { ErrorToastLayer } from './app/ErrorToastLayer'
import { RootGate } from './app/RootGate'
import { MailArchiveEvidenceBridge } from './app/MailArchiveEvidenceBridge'

function App(): React.JSX.Element {
  return (
    <TweakProvider>
      <BrowserRouter>
        <BackendProvider>
          <SessionsProvider>
            <CostProvider>
              <UpdateProvider>
                <ChatProvider>
                  <MailArchiveEvidenceBridge>
                    <RootGate />
                    <ErrorToastLayer />
                  </MailArchiveEvidenceBridge>
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
