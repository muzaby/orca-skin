import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import '../../../src/renderer/src/styles/app.css'
import '../../../src/renderer/src/shared/i18n'
import { Sidebar } from '../../../src/renderer/src/app/Sidebar'
import { ChatTitleBar } from '../../../src/renderer/src/features/chat/components/ChatTitleBar'
import { Composer } from '../../../src/renderer/src/features/chat/components/Composer'
import { harnessLanding } from '../../../src/renderer/src/features/chat/harnesses/registries/landing'
import { ProjectLandingPage } from '../../../src/renderer/src/pages/ProjectLandingPage'
import { useProjectsStore } from '../../../src/renderer/src/features/projects/store/projectsStore'
import { TweakProvider, useTweakContext } from '../../../src/renderer/src/shared/theme'
import {
  useChatStore,
  useChatSession
} from '../../../src/renderer/src/features/chat/store/chatStore'
import { initialChatState } from '../../../src/renderer/src/features/chat/reducer/chatReducer'
import { installNativeFixture } from '../opencode-ui/native'
import type { NativeResources, SetNativeResource } from '../../../src/shared/native-resources'
installNativeFixture()
useProjectsStore.setState({
  loading: false,
  list: [
    {
      id: 'fixture',
      name: '하네스 프로젝트',
      instructions: '',
      cwd: 'C:/fixture',
      createdAt: 0,
      updatedAt: 0,
      pinnedAt: null
    }
  ]
})
const base = window.orca
let enabled = true
const snapshot = (): NativeResources => ({
  state: 'connected',
  generation: 'fixture',
  commands: [
    {
      name: 'superpowers:using-superpowers',
      description: '스킬을 찾고 활용하는 방법을 안내합니다.',
      argumentHint: '<파일 또는 범위>',
      source: 'plugin'
    },
    {
      name: 'mcp__filesystem__list',
      description: '프로젝트 파일을 찾습니다.',
      argumentHint: '<경로>',
      source: 'mcp'
    }
  ],
  items: [
    {
      id: 'native',
      name: 'Filesystem',
      kind: 'mcp',
      status: enabled ? 'connected' : 'disabled',
      enabled,
      canToggle:
        useChatStore.getState().sessions[useChatStore.getState().activeKey]?.session.backend ===
        'claude'
    },
    {
      id: 'auth',
      name: 'GitHub',
      kind: 'mcp',
      status: 'needs-auth',
      enabled: true,
      canToggle: false
    },
    {
      id: 'plugin',
      name: 'superpowers',
      description: '개발 작업을 돕는 워크플로 스킬 모음입니다.',
      kind: 'plugin',
      status: 'enabled',
      enabled: true,
      canToggle: false
    }
  ]
})
window.orca = new Proxy(base, {
  get(target, name) {
    if (name === 'session')
      return {
        ...target.session,
        nativeResources: async () => snapshot(),
        openNativePlugin: async () => {
          document.querySelector('[data-fixture-open-folder]')?.remove()
          const notice = document.createElement('p')
          notice.setAttribute('data-fixture-open-folder', '')
          notice.setAttribute('role', 'status')
          notice.textContent = '목업: superpowers 설치 폴더 열기 요청'
          document.body.append(notice)
        },
        setNativeResource: async (request: SetNativeResource) => {
          enabled = request.enabled
          return snapshot()
        }
      }
    return Reflect.get(target, name)
  }
})
function seed(backend: 'claude' | 'opencode', saved = true): void {
  useChatStore.setState({
    sessions: {
      fixture: {
        session: {
          ...initialChatState,
          sessionId: saved ? 'fixture' : null,
          title: '하네스 연결 확인',
          backend,
          agentKind: backend === 'opencode' ? 'code' : 'work',
          cwd: 'C:/fixture'
        },
        live: { text: '', reasoning: '' },
        subagentMeta: {}
      }
    },
    activeKey: 'fixture',
    pendingNewChatKey: null,
    newChatQueue: [],
    recentsEpoch: 0,
    concurrencyByProjectId: {},
    draftRestore: null
  })
}
seed('claude', false)
export function App(): React.JSX.Element {
  const navigate = useNavigate()
  const { t, setTweak } = useTweakContext((value) => value)
  const backend = useChatSession((value) => value.backend)
  const Header = harnessLanding(backend).Header
  return (
    <main className="flex h-screen w-full flex-col bg-bg text-ink [font-family:var(--font-app)]">
      <div className="flex gap-4 p-3 text-footnote">
        <button onClick={() => setTweak('theme', t.theme === 'white' ? 'dark' : 'white')}>
          테마 전환
        </button>
        <button onClick={() => setTweak('sidebarCollapsed', !t.sidebarCollapsed)}>
          nav 접기/펼치기
        </button>
        <button onClick={() => setTweak('sidebarWidth', t.sidebarWidth === 248 ? 380 : 248)}>
          nav 너비
        </button>
        <button onClick={() => seed('claude')}>Claude 세션</button>
        <button onClick={() => seed('opencode')}>OpenCode 세션</button>
        <button
          onClick={() => {
            seed('claude', false)
            navigate('/projects/fixture')
          }}
        >
          프로젝트 화면
        </button>
        <button onClick={() => navigate('/new')}>메뉴 화면</button>
      </div>
      <div className="flex min-h-0 flex-1">
        <Sidebar projectsSlot={null} pinnedSlot={null} sessionsSlot={null} footerSlot={null} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ChatTitleBar />
          <Routes>
            <Route
              path="/projects/:projectId"
              element={<ProjectLandingPage onDeleteProject={() => {}} />}
            />
            <Route
              path="*"
              element={
                <>
                  <div className="flex flex-1 items-center justify-center">
                    <Header />
                  </div>
                  <div className="mx-auto w-full max-w-3xl px-4 pb-6">
                    <Composer
                      backendLabel={backend === 'opencode' ? 'OpenCode' : 'Claude'}
                      canAbort={true}
                    />
                  </div>
                </>
              }
            />
          </Routes>
        </div>
      </div>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/new']}>
    <TweakProvider>
      <App />
    </TweakProvider>
  </MemoryRouter>
)
