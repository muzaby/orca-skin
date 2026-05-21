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
import { DENSITY_FONT } from './app/theme'
import { useChat } from './state/useChat'
import { useBackend } from './state/useBackend'
import { useSessions } from './state/useSessions'
import { InstallerDialog } from './components/install/InstallerDialog'
import { AuthExpiredModal } from './components/auth/AuthExpiredModal'

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('chat')
  const [t, setTweak] = useTweaks()
  const chat = useChat()
  const backend = useBackend()
  const sessions = useSessions()
  const [installerOpen, setInstallerOpen] = useState(false)
  const autoOpenedRef = useRef(false)

  // 채팅 턴이 끝나면 (inflight false 로 전환) 사이드바 목록을 새로고침. 새 init 이
  // 발급되어 sessions row 가 추가됐을 수 있고, 기존 세션의 preview/updated_at 도 갱신됐다.
  const wasInflightRef = useRef(false)
  useEffect(() => {
    if (wasInflightRef.current && !chat.state.inflight) {
      void sessions.refresh()
    }
    wasInflightRef.current = chat.state.inflight
  }, [chat.state.inflight, sessions])

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
              sessions={sessions.list}
              activeSessionId={chat.state.sessionId}
              onSelectSession={(id) => {
                setScreen('chat')
                // 사이드바 메타에서 즉시 표시할 제목을 함께 전달 — 메시지 도착 전에도
                // 헤더 / 사이드바 라벨이 일치하도록.
                const meta = sessions.list.find((s) => s.id === id)
                const metaTitle = meta?.title?.trim() || meta?.preview?.trim() || null
                void chat.loadSession(id, metaTitle)
              }}
              onDeleteSession={(id) => {
                chat.invalidateSessionCache(id)
                void sessions.remove(id).then(() => {
                  if (chat.state.sessionId === id) chat.newChat()
                })
              }}
              onRenameSession={(id, title) => {
                // reducer state.title 즉시 갱신 + DB flush + 사이드바 refresh 를
                // useChat / useSessions 가 각자 처리.
                void chat.renameSession(id, title)
                void sessions.rename(id, title)
              }}
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
