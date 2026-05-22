import { useCallback, useEffect, useRef, useState } from 'react'
import { Frame } from './app/Frame'
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
import { Home as V5Home } from './screens/v5/Home'
import { Projects as V5Projects } from './screens/v5/Projects'
import { ProjectDetail as V5ProjectDetail } from './screens/v5/ProjectDetail'
import { Task as V5Task, type TaskVariant } from './screens/v5/Task'
import { NewProjectModals, type ModalVariant, type NewProjectPayload } from './screens/v5/modals'
import { Settings as V5Settings } from './screens/v5/Settings'
import { AccountMenuScreen as V5AccountMenu } from './screens/v5/AccountMenuScreen'
import {
  ScheduleEmpty as V5SchedEmpty,
  ScheduleList as V5SchedList,
  ScheduleDetail as V5SchedDetail,
  ScheduleChat as V5SchedChat,
  ScheduleDone as V5SchedDone
} from './screens/v5/Schedule'
import { V5Sidebar } from './screens/v5/V5Sidebar'

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('chat')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  // v5 task variant + right-panel toggle. Local to App so the toggle in
  // ChatHeader can flip it without remounting the screen.
  const [taskVariant, setTaskVariant] = useState<TaskVariant>('running')
  const [taskPanelOpen, setTaskPanelOpen] = useState(true)
  const [modalVariant, setModalVariant] = useState<ModalVariant>('root')
  // v5 모달 진입 직전 origin 화면 — 모달 닫기 시 v5-home/v5-projects 등으로 복귀.
  const [modalOrigin, setModalOrigin] = useState<ScreenId | null>(null)
  const openV5Modal = useCallback((origin: ScreenId) => {
    setModalOrigin(origin)
    setScreen('v5-modals')
  }, [])
  const closeV5Modal = useCallback(() => {
    setScreen(modalOrigin ?? 'v5-home')
    setModalOrigin(null)
    setModalVariant('root')
  }, [modalOrigin])
  const [t, setTweak] = useTweaks()
  const chat = useChat()
  const backend = useBackend()
  const sessions = useSessions()
  // App.tsx 단일 인스턴스 — Sidebar (라벨 prefix lookup), Projects (그리드),
  // ProjectDetail (헤더/지침 표시 + update) 가 모두 같은 state 를 공유.
  const projects = useProjects()
  // start variant '만들기' 클릭 → 실 project 저장 + origin 으로 복귀.
  const handleV5ModalCreate = useCallback(
    async (payload?: NewProjectPayload) => {
      if (payload && payload.name) {
        await projects.create(payload.name, payload.instructions)
      }
      closeV5Modal()
    },
    [projects, closeV5Modal]
  )
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

  // v5 화면은 별도 셸 (V5Sidebar) 로 렌더. 레거시 Sidebar 의 세션 상태와 분리되어
  // v5 디자인을 격리 검증할 수 있다. v5 화면들이 모두 옮겨지면 본 분기 자체가
  // 기본 경로가 된다.
  if (
    screen === 'v5-home' ||
    screen === 'v5-projects' ||
    screen === 'v5-project-detail' ||
    screen === 'v5-task' ||
    screen === 'v5-modals' ||
    screen === 'v5-settings' ||
    screen === 'v5-artifact' ||
    screen === 'v5-menu-account' ||
    screen === 'v5-menu-lang' ||
    screen === 'v5-sched-empty' ||
    screen === 'v5-sched-list' ||
    screen === 'v5-sched-detail' ||
    screen === 'v5-sched-chat' ||
    screen === 'v5-sched-done'
  ) {
    // 모달이 떠 있을 때 어느 화면 위에 떠 있는지 — origin (v5-home / v5-projects 등).
    const baseScreen: ScreenId = screen === 'v5-modals' ? (modalOrigin ?? 'v5-home') : screen
    const sidebarActive =
      baseScreen === 'v5-projects' || baseScreen === 'v5-project-detail'
        ? 'projects'
        : baseScreen.startsWith('v5-sched')
          ? 'scheduled'
          : 'newTask'
    const v5SelectedProject = selectedProjectId
      ? projects.list.find((p) => p.id === selectedProjectId)
      : undefined
    return (
      <>
        <div className="h-full w-full">
          <Frame label={`Orca · ${current.label}`}>
            <Titlebar breadcrumb={current.breadcrumb} />
            <div className="flex min-h-0 flex-1">
              <V5Sidebar
                active={sidebarActive}
                onLeaveV5={() => setScreen('chat')}
                onNav={(id) => {
                  if (id === 'newTask') setScreen('v5-home')
                  else if (id === 'projects') setScreen('v5-projects')
                }}
              />
              {baseScreen === 'v5-home' ? (
                <V5Home onNewProject={() => openV5Modal('v5-home')} />
              ) : baseScreen === 'v5-projects' ? (
                <V5Projects
                  projects={projects.list}
                  onNewProject={() => openV5Modal('v5-projects')}
                  onOpenProject={(id) => {
                    setSelectedProjectId(id)
                    setScreen('v5-project-detail')
                  }}
                />
              ) : baseScreen === 'v5-project-detail' && v5SelectedProject ? (
                <V5ProjectDetail
                  project={v5SelectedProject}
                  chat={chat}
                  onBack={() => setScreen('v5-projects')}
                  onLeaveToChat={goChat}
                />
              ) : screen === 'v5-settings' ? (
                <V5Settings onClose={() => setScreen('v5-home')} />
              ) : screen === 'v5-menu-account' ? (
                <V5AccountMenu />
              ) : screen === 'v5-menu-lang' ? (
                <V5AccountMenu withLang />
              ) : screen === 'v5-sched-empty' ? (
                <V5SchedEmpty />
              ) : screen === 'v5-sched-list' ? (
                <V5SchedList onOpenTask={() => setScreen('v5-sched-detail')} />
              ) : screen === 'v5-sched-detail' ? (
                <V5SchedDetail onBack={() => setScreen('v5-sched-list')} />
              ) : screen === 'v5-sched-chat' ? (
                <V5SchedChat />
              ) : screen === 'v5-sched-done' ? (
                <V5SchedDone />
              ) : screen === 'v5-artifact' ? (
                <V5Task
                  variant="artifact"
                  panelOpen
                  onCloseArtifact={() => setScreen('v5-task')}
                />
              ) : (
                <V5Task
                  variant={taskVariant}
                  title={v5SelectedProject ? `${v5SelectedProject.name} / New conversation` : undefined}
                  panelOpen={taskPanelOpen}
                  onTogglePanel={() => setTaskPanelOpen((v) => !v)}
                />
              )}
            </div>
            {screen === 'v5-modals' && (
              <NewProjectModals
                variant={modalVariant}
                onPick={setModalVariant}
                onClose={closeV5Modal}
                onCreate={(payload) => void handleV5ModalCreate(payload)}
              />
            )}
            {/* Temporary in-browser variant selector for the task screen demo.
                Removed once routing covers the 3 variants individually. */}
            {screen === 'v5-task' && (
              <div
                style={{
                  position: 'fixed',
                  right: 12,
                  bottom: 12,
                  display: 'flex',
                  gap: 4,
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: 4,
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 50
                }}
              >
                {(['running', 'approval', 'result'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTaskVariant(v)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      background: taskVariant === v ? 'var(--press)' : 'transparent',
                      color: taskVariant === v ? 'var(--ink)' : 'var(--ink-3)',
                      border: 0,
                      cursor: 'pointer'
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </Frame>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="h-full w-full">
        <Frame label={`Orca · ${current.label}`}>
          <Titlebar breadcrumb={current.breadcrumb} />
          <div className="flex min-h-0 flex-1">
            <Sidebar
              active={screen === 'project-detail' ? 'projects' : screen}
              collapsed={t.sidebarCollapsed}
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
