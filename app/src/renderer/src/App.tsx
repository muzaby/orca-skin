import { TweakProvider } from './shared/theme'
import { NavigationProvider } from './shared/navigation'
import { BackendProvider } from './features/backend'
import { SessionsProvider } from './features/sessions'
import { ProjectsProvider } from './features/projects'
import { ChatProvider } from './features/chat'
import { AppLayout } from './app/AppLayout'

function App(): React.JSX.Element {
  return (
    <TweakProvider>
      <NavigationProvider>
        <BackendProvider>
          <SessionsProvider>
            <ProjectsProvider>
              <ChatProvider>
                <AppLayout />
              </ChatProvider>
            </ProjectsProvider>
          </SessionsProvider>
        </BackendProvider>
      </NavigationProvider>
    </TweakProvider>
  )
}

export default App
