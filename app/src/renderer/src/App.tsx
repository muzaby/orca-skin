import { TweakProvider } from './app/providers/TweakProvider'
import { NavigationProvider } from './app/providers/NavigationProvider'
import { BackendProvider } from './app/providers/BackendProvider'
import { SessionsProvider } from './app/providers/SessionsProvider'
import { ProjectsProvider } from './app/providers/ProjectsProvider'
import { ChatProvider } from './app/providers/ChatProvider'
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
