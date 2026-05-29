import { BrowserRouter } from 'react-router-dom'
import { TweakProvider } from './shared/theme'
import { BackendProvider } from './features/backend'
import { RuntimeProvider } from './features/runtime'
import { SessionsProvider } from './features/sessions'
import { ProjectsProvider } from './features/projects'
import { ChatProvider } from './features/chat'
import { AppLayout } from './app/AppLayout'

function App(): React.JSX.Element {
  return (
    <TweakProvider>
      <BrowserRouter>
        <BackendProvider>
          <RuntimeProvider>
            <SessionsProvider>
              <ProjectsProvider>
                <ChatProvider>
                  <AppLayout />
                </ChatProvider>
              </ProjectsProvider>
            </SessionsProvider>
          </RuntimeProvider>
        </BackendProvider>
      </BrowserRouter>
    </TweakProvider>
  )
}

export default App
