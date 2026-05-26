import { useCallback, useEffect, useRef, useState } from 'react'
import { Frame, FrameGrid, FrameBody, ModalSlot, OverlaySlot } from './app/Frame'
import { Titlebar } from './app/Titlebar'
import { Sidebar } from './app/Sidebar'
import { ChatPane } from './app/ChatPane'
// CameraPane 은 일반 'chat' 화면에서 자동 노출하지 않음 — 추후 별도 노출 방법 논의.
// 컴포넌트는 보존 (`./app/CameraPane`).
import { Projects } from './app/Projects'
import { ProjectDetail } from './app/ProjectDetail'
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
import { useProjects } from './state/useProjects'
import { InstallerDialog } from './components/install/InstallerDialog'
import { AuthExpiredModal } from './components/auth/AuthExpiredModal'

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('chat')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [t, setTweak] = useTweaks()
  const chat = useChat()
  const backend = useBackend()
  const sessions = useSessions()
  // App.tsx 단일 인스턴스 — Sidebar (라벨 prefix lookup), Projects (그리드),
  // ProjectDetail (헤더/지침 표시 + update) 가 모두 같은 state 를 공유.
  const projects = useProjects()
  const [installerOpen, setInstallerOpen] = useState(false)
  const autoOpenedRef = useRef(false)

  // ProjectDetail 이 매 render 마다 effect 재실행되지 않도록 stable callback.
  const goChat = useCallback(() => setScreen('chat'), [])

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

  // 가이드라인 §0 — html[data-platform] 부착. preload 가 sync 노출하므로 mount 직후 1회.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.orca?.platform) {
      document.documentElement.dataset.platform = window.orca.platform
    }
  }, [])

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
    body = <ChatPane chat={chat} backendLabel={backendLabel} />
  } else if (screen === 'projects') {
    body = (
      <Projects
        projects={projects.list}
        loading={projects.loading}
        onOpenProject={(id) => {
          setSelectedProjectId(id)
          setScreen('project-detail')
        }}
        onCreate={async (name, instructions) => {
          await projects.create(name, instructions)
        }}
      />
    )
  } else if (screen === 'project-detail' && selectedProjectId) {
    body = (
      <ProjectDetail
        projectId={selectedProjectId}
        projects={projects.list}
        chat={chat}
        backendLabel={backendLabel}
        onBack={() => setScreen('projects')}
        onLeaveToChat={goChat}
        onUpdateInstructions={async (instructions) => {
          await projects.update(selectedProjectId, { instructions })
        }}
      />
    )
  } else if (screen === 'engine') body = <EngineSettings />
  else if (screen === 'skills') body = <SkillsMcp />
  else body = <CapturesPlaceholder />

  const current = SCREENS.find((s) => s.id === screen)!
  const authExpired = chat.state.error?.code === 'auth.expired'
  // 두 모달은 동시에 열리지 않는다 — 같은 #app-frame-modal 슬롯에 conditional render.
  const anyModalOpen = installerOpen || authExpired

  return (
    <Frame label={`Orca · ${current.label}`}>
      <Titlebar breadcrumb={current.breadcrumb} />
      <FrameGrid>
        <FrameBody>
          <Sidebar
            active={screen === 'project-detail' ? 'projects' : screen}
            collapsed={t.sidebarCollapsed}
            width={t.sidebarWidth}
            onWidthChange={(w) => setTweak('sidebarWidth', w)}
            onSelect={setScreen}
            onNewChat={chat.newChat}
            backendLabel={backendLabel}
            backendInstalled={claudeCode?.installed === true}
            sessions={sessions.list}
            projects={projects.list}
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
        </FrameBody>

        <OverlaySlot visible={true}>
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
        </OverlaySlot>

        <ModalSlot visible={anyModalOpen}>
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
        </ModalSlot>
      </FrameGrid>
    </Frame>
  )
}

export default App
