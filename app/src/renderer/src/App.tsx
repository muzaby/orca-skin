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
import { THEME_PALETTES, DENSITY_FONT, V1, type ThemeId, type DensityId } from './app/theme'

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

  // Theme — rewrite V1 colour tokens in place before children read them.
  // The `key={t.theme}` on the frame wrapper below remounts the tree so
  // cached inline-style colours pick up the new palette.
  Object.assign(V1, THEME_PALETTES[t.theme])

  useEffect(() => {
    document.body.style.background = V1.bg
  }, [t.theme])

  // Density — scales the root font size; cascades to em/rem spacing in
  // child components.
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
      <div key={t.theme} style={{ width: '100%', height: '100%' }}>
        <Frame label={`Orca · ${current.label}`}>
          <Titlebar breadcrumb={current.breadcrumb} />
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
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
