import { useEffect, useState } from 'react'
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

  // Theme — set `data-theme` on <html>; tokens.css overrides --color-*
  // variables under each scope, so all Tailwind utilities re-resolve.
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme
  }, [t.theme])

  // Density — root font-size cascades to rem-based Tailwind spacing.
  useEffect(() => {
    document.documentElement.style.fontSize = DENSITY_FONT[t.density] + 'px'
  }, [t.density])

  let body: React.ReactNode
  if (screen === 'chat') {
    body = (
      <>
        <ChatPane />
        <CameraPane />
      </>
    )
  } else if (screen === 'projects') body = <Projects />
  else if (screen === 'engine') body = <EngineSettings />
  else if (screen === 'skills') body = <SkillsMcp />
  else body = <CapturesPlaceholder />

  const current = SCREENS.find((s) => s.id === screen)!

  return (
    <>
      <div className="h-full w-full">
        <Frame label={`Orca · ${current.label}`}>
          <Titlebar breadcrumb={current.breadcrumb} />
          <div className="flex min-h-0 flex-1">
            <Sidebar active={screen} collapsed={t.sidebarCollapsed} onSelect={setScreen} />
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
    </>
  )
}

export default App
