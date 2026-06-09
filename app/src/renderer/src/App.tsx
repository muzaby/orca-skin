import { BrowserRouter } from 'react-router-dom'
import { TweakProvider } from './shared/theme'
import { BackendProvider } from './features/backend'
import { SessionsProvider } from './features/sessions'
import { ProjectsProvider } from './features/projects'
import { ChatProvider } from './features/chat'
import { CostProvider } from './features/cost'
import { AppLayout } from './app/AppLayout'

function App(): React.JSX.Element {
  return (
    <TweakProvider>
      <BrowserRouter>
        <BackendProvider>
          <SessionsProvider>
            <ProjectsProvider>
              <CostProvider>
                <ChatProvider>
                  <AppLayout />
                </ChatProvider>
              </CostProvider>
            </ProjectsProvider>
          </SessionsProvider>
        </BackendProvider>
      </BrowserRouter>
    </TweakProvider>
  )
}

export default App
