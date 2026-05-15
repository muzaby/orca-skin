import { useEffect, useRef, useState } from 'react'
import { Frame } from './app/Frame'
import { Titlebar } from './app/Titlebar'
import { Sidebar } from './app/Sidebar'
import { ChatPane } from './app/ChatPane'
import { CameraPane } from './app/CameraPane'
import { Projects } from './app/Projects'
import { EngineSettings } from './app/EngineSettings'
import { SkillsMcp } from './app/SkillsMcp'
import { CapturesPlaceholder } from './app/CapturesPlaceholder'
import { TweaksPanel, TweakSection, TweakRadio, TweakToggle } from './app/TweaksPanel'
import { useTweaks } from './app/useTweaks'
import { SCREENS, type ScreenId } from './app/screens'
import { DENSITY_FONT, type ThemeId, type DensityId } from './app/theme'
import { useChat } from './state/useChat'
import { useBackend } from './state/useBackend'
import { InstallerDialog } from './components/install/InstallerDialog'
import { AuthExpiredModal } from './components/auth/AuthExpiredModal'

interface Tweaks {
  theme: ThemeId
  density: DensityId
  sidebarCollapsed: boolean
}

const TWEAK_DEFAULTS: Tweaks = {
  theme: 'classic',
  density: 'normal',
  sidebarCollapsed: false
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('chat')
  const [t, setTweak] = useTweaks<Tweaks>(TWEAK_DEFAULTS)
  const chat = useChat()
  const backend = useBackend()
  const [installerOpen, setInstallerOpen] = useState(false)
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    document.documentElement.dataset.theme = t.theme
  }, [t.theme])

  useEffect(() => {
    document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px'
  }, [t.density])

  // 백엔드 탐지 후 미설치면 인스톨러 노출 (최초 1회만 자동 오픈)
  useEffect(() => {
    if (backend.loading || autoOpenedRef.current) return
    const cc = backend.list.find((b) => b.id === 'claude-code')
    if (cc && !cc.installed) {
      autoOpenedRef.current = true
      queueMicrotask(() => setInstallerOpen(true))
    }
  }, [backend.loading, backend.list])

  const claudeCode = backend.list.find((b) => b.id === 'claude-code')
  const backendLabel = claudeCode?.version ? `Claude Code · ${claudeCode.version}` : 'Claude Code'

  let body: React.ReactNode
  if (screen === 'chat') {
    body = (
      <>
        <ChatPane chat={chat} backendLabel={backendLabel} />
        <CameraPane />
      </>
    )
  } else if (screen === 'projects') body = <Projects />
  else if (screen === 'engine') body = <EngineSettings />
  else if (screen === 'skills') body = <SkillsMcp />
  else body = <CapturesPlaceholder />

  const current = SCREENS.find((s) => s.id === screen)!
  const authExpired = chat.state.error?.code === 'auth.expired'

  return (
    <>
      <div className="h-full w-full">
        <Frame label={`Orca · ${current.label}`}>
          <Titlebar breadcrumb={current.breadcrumb} />
          <div className="flex min-h-0 flex-1">
            <Sidebar
              active={screen}
              collapsed={t.sidebarCollapsed}
              onSelect={setScreen}
              onNewChat={chat.newChat}
              backendLabel={backendLabel}
              backendInstalled={claudeCode?.installed === true}
            />
            {body}
          </div>
        </Frame>
      </div>

      <TweaksPanel>
        <TweakSection label="테마" />
        <TweakRadio
          label="컬러 팔레트"
          value={t.theme}
          options={[
            { value: 'classic', label: '클래식' },
            { value: 'dark', label: '다크' },
            { value: 'cool', label: '쿨' }
          ]}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakSection label="레이아웃" />
        <TweakRadio
          label="밀도"
          value={t.density}
          options={[
            { value: 'compact', label: '조밀' },
            { value: 'normal', label: '보통' },
            { value: 'comfortable', label: '넓게' }
          ]}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakToggle
          label="사이드바 접기"
          value={t.sidebarCollapsed}
          onChange={(v) => setTweak('sidebarCollapsed', v)}
        />
      </TweaksPanel>

      <InstallerDialog
        open={installerOpen}
        onClose={() => setInstallerOpen(false)}
        onComplete={() => {
          setInstallerOpen(false)
          void backend.refresh()
        }}
      />

      <AuthExpiredModal
        open={authExpired}
        onNewChat={() => {
          chat.newChat()
        }}
        onDismiss={chat.clearError}
      />
    </>
  )
}

export default App
