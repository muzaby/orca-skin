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
import { ScreenTabs } from './app/ScreenTabs'
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
    const win = document.getElementById('appWin')
    if (win) win.style.background = V1.bg
  }, [t.theme])

  // Density — scales the base font size inside the app frame; cascades to all
  // em/rem spacing in child components.
  useEffect(() => {
    const win = document.getElementById('appWin')
    if (win) win.style.fontSize = DENSITY_FONT[t.density] + 'px'
  }, [t.density])

  // Auto-scale the 1280×820 window to fit any viewport.
  useEffect(() => {
    const fit = (): void => {
      const win = document.getElementById('appWin')
      if (!win) return
      const W = window.innerWidth
      const H = window.innerHeight - 48
      const sx = (W - 80) / 1280
      const sy = (H - 80) / 820
      const s = Math.min(1, sx, sy)
      win.style.transform = `translate(-50%, calc(-50% - 24px)) scale(${s})`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

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
      <div className="desktop">
        <div className="mockup-tag">
          <span className="dot"></span>
          Orca · Electron BrowserWindow
        </div>

        <ScreenTabs screen={screen} onSelect={setScreen} />

        <div className="stage">
          <div className="app-window" id="appWin">
            <div key={t.theme} style={{ width: '100%', height: '100%' }}>
              <Frame label={`Orca · ${current.label}`}>
                <Titlebar breadcrumb={current.breadcrumb} />
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                  <Sidebar active={screen} collapsed={t.sidebarCollapsed} onSelect={setScreen} />
                  {body}
                </div>
              </Frame>
            </div>
          </div>
        </div>

        <div className="taskbar">
          <div className="tb-tab" title="Start">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="rgba(255,255,255,.85)">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </div>
          <div className="tb-tab" title="Search">
            🔍
          </div>
          <div className="taskbar-icons">
            <div className="tb-tab">📁</div>
            <div className="tb-tab">🌐</div>
            <div className="tb-tab">✉</div>
            <div className="tb-tab active" title="Orca">
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: '#c96442',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  fontFamily: 'var(--serif)',
                  fontWeight: 700,
                  fontSize: 11
                }}
              >
                O
              </div>
            </div>
            <div className="tb-tab">⚙</div>
          </div>
          <div className="tb-tray">
            <span style={{ opacity: 0.7 }}>▲</span>
            <div className="badge">O</div>
            <span style={{ opacity: 0.7 }}>🔊</span>
            <span style={{ opacity: 0.7 }}>📶</span>
            <div className="tb-clock">
              <div>14:42</div>
              <div className="date">2026-05-09</div>
            </div>
          </div>
        </div>
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
