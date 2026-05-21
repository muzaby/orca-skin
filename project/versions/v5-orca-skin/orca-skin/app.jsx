// Orca Skin — App composition
// Single window mock with a thin screen-switcher overlay so the user
// can flip through every screen captured in the reference set.

const SCREENS = [
  { id: 'home',          label: '01 홈' },
  { id: 'home-dark',     label: '02 홈 (다크)' },
  { id: 'home-folder',   label: '03 폴더 선택' },
  { id: 'modal-create',  label: '04 새 프로젝트' },
  { id: 'modal-start',   label: '05 처음부터' },
  { id: 'modal-import',  label: '06 가져오기' },
  { id: 'modal-folder',  label: '07 기존 폴더' },
  { id: 'task-init',     label: '08 작업 시작' },
  { id: 'task-approval', label: '09 승인 요청' },
  { id: 'task-result',   label: '10 결과' },
  { id: 'task-artifact', label: '11 아티팩트' },
  { id: 'sched-empty',   label: '12 스케줄 빈' },
  { id: 'sched-list',    label: '13 스케줄 목록' },
  { id: 'sched-chat',    label: '14 스케줄 대화' },
  { id: 'sched-done',    label: '15 스케줄 생성됨' },
  { id: 'sched-detail',  label: '16 스케줄 상세' },
  { id: 'menu-account',  label: '17 계정 메뉴' },
  { id: 'menu-lang',     label: '18 언어 서브메뉴' },
  { id: 'settings',      label: '19 설정' },
];

const RECENTS_HOME = [
  { id: 'cs', title: 'Create new project with Paint' },
  { id: 'ns', title: 'New scheduled task' },
];

const RECENTS_TASK = [
  { id: 'cs', title: 'Check and summarize download fold', active: true },
  { id: 'pa', title: 'Create new project with Paint' },
  { id: 'ns', title: 'New scheduled task' },
];

const STEPS_INIT = [
  { label: '30초 대기 중', done: false },
  { label: '다운로드 폴더 접근 및 파일 점검', done: false },
  { label: '결과에 따라 처리', done: false },
];
const STEPS_APPROVAL = [
  { label: '30초 대기', done: true },
  { label: '다운로드 폴더 점검 중', done: false, pending: true },
  { label: '결과에 따라 처리', done: false },
];
const STEPS_DONE = [
  { label: '30초 대기', done: true },
  { label: '다운로드 폴더 접근 및 파일 점검', done: true },
  { label: '결과에 따라 처리', done: true },
];

function App() {
  // URL hash drives the current screen so refreshes preserve it.
  const [screen, setScreen] = React.useState(() => {
    const h = (location.hash || '').slice(1);
    return SCREENS.find((s) => s.id === h)?.id || 'home';
  });
  const [rightPanel, setRightPanel] = React.useState(true);
  const [folderMenu, setFolderMenu] = React.useState(false);

  React.useEffect(() => {
    location.hash = screen;
    document.documentElement.dataset.theme = (screen === 'home-dark') ? 'dark' : 'light';
  }, [screen]);

  // Sync hash changes (back/forward buttons in browser)
  React.useEffect(() => {
    const onHash = () => {
      const h = (location.hash || '').slice(1);
      if (SCREENS.find((s) => s.id === h)) setScreen(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const isHome = screen.startsWith('home');
  const isTask = screen.startsWith('task');
  const isModal = screen.startsWith('modal');
  const isSched = screen.startsWith('sched');
  const isMenu = screen.startsWith('menu');

  // Sidebar active item + recents (vary by screen)
  let sidebarActive = 'newTask';
  if (isSched) sidebarActive = 'scheduled';

  const RECENTS_SCHED = [
    { id: 'db', title: 'Daily brief', active: screen === 'sched-chat' || screen === 'sched-done' },
    { id: 'cs', title: 'Check and summarize download fold' },
    { id: 'pa', title: 'Create new project with Paint' },
    { id: 'ns', title: 'New scheduled task' },
  ];
  let recents = isTask ? RECENTS_TASK : RECENTS_HOME;
  if (isSched || isMenu) recents = RECENTS_SCHED;

  // Top-bar title — only on task screens
  const winTitle = isTask ? null : null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Titlebar title={winTitle} sidebarOpen onSidebarToggle={() => {}}/>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar
          active={sidebarActive}
          recents={recents}
          mode="cowork"
        />

        {/* Home variants */}
        {(screen === 'home' || screen === 'home-dark') && (
          <ScreenHome
            folderOpen={false}
            onOpenFolder={() => setScreen('home-folder')}
            onCreate={() => setScreen('modal-create')}
          />
        )}
        {screen === 'home-folder' && (
          <ScreenHome
            folderOpen
            onOpenFolder={() => setScreen('home')}
            onCreate={() => setScreen('modal-create')}
          />
        )}

        {/* Modals — show the home screen behind, then overlay the modal */}
        {isModal && (
          <>
            <ScreenHome folderOpen={false} onCreate={() => {}} onOpenFolder={() => {}}/>
            {screen === 'modal-create' && (
              <ModalNewProject
                onPick={(k) => setScreen('modal-' + k)}
                onClose={() => setScreen('home')}
              />
            )}
            {screen === 'modal-start' && (
              <ModalNewProjectStart
                onBack={() => setScreen('modal-create')}
                onClose={() => setScreen('home')}
              />
            )}
            {screen === 'modal-import' && (
              <ModalNewProjectImport
                onBack={() => setScreen('modal-create')}
                onClose={() => setScreen('home')}
              />
            )}
            {screen === 'modal-folder' && (
              <ModalNewProjectFolder
                onBack={() => setScreen('modal-create')}
                onClose={() => setScreen('home')}
              />
            )}
          </>
        )}

        {/* Task screens */}
        {screen === 'task-init' && (
          <>
            <ScreenTaskRunning panelOpen={rightPanel} onTogglePanel={() => setRightPanel(!rightPanel)}/>
            {rightPanel && <RightPanel steps={STEPS_INIT}/>}
          </>
        )}
        {screen === 'task-approval' && (
          <>
            <ScreenApproval panelOpen={rightPanel} onTogglePanel={() => setRightPanel(!rightPanel)}/>
            {rightPanel && (
              <RightPanel
                steps={STEPS_APPROVAL}
                folderItems={[
                  { kind: '', label: '', icon: 'projects' },
                ]}
              />
            )}
          </>
        )}
        {screen === 'task-result' && (
          <>
            <ScreenTaskResult
              panelOpen={rightPanel}
              onTogglePanel={() => setRightPanel(!rightPanel)}
              onOpenArtifact={() => setScreen('task-artifact')}
            />
            {rightPanel && (
              <RightPanel
                steps={STEPS_DONE}
                folderItems={[
                  { kind: '지침 ·', label: 'CLAUDE.md', icon: 'doc' },
                  { kind: '', label: 'downloads_summary.md', icon: 'docMd' },
                ]}
              />
            )}
          </>
        )}
        {screen === 'task-artifact' && (
          <>
            <ScreenTaskResult
              panelOpen
              onTogglePanel={() => {}}
              onOpenArtifact={() => {}}
            />
            <ArtifactPanel onClose={() => setScreen('task-result')}/>
          </>
        )}

        {/* Schedule menu scenarios */}
        {screen === 'sched-empty' && <ScreenScheduledEmpty/>}
        {screen === 'sched-list' && (
          <ScreenScheduledList onOpenTask={() => setScreen('sched-detail')}/>
        )}
        {screen === 'sched-detail' && (
          <ScreenScheduleDetail onBack={() => setScreen('sched-list')}/>
        )}
        {screen === 'sched-chat' && (
          <>
            <ScreenScheduleChat panelOpen={rightPanel} onTogglePanel={() => setRightPanel(!rightPanel)}/>
            {rightPanel && <RightPanel steps={STEPS_APPROVAL}/>}
          </>
        )}
        {screen === 'sched-done' && (
          <>
            <ScreenScheduleDone panelOpen={rightPanel} onTogglePanel={() => setRightPanel(!rightPanel)}/>
            {rightPanel && <RightPanel steps={STEPS_DONE}/>}
          </>
        )}

        {/* Settings menu scenarios */}
        {(screen === 'menu-account' || screen === 'menu-lang') && (
          <ScreenAccountMenu
            withLang={screen === 'menu-lang'}
            onCreate={() => {}}
            onOpenFolder={() => {}}
          />
        )}
        {screen === 'settings' && (
          <ScreenSettings onClose={() => setScreen('home')}/>
        )}
      </div>

      <ScreenSwitcher screen={screen} onChange={setScreen}/>
    </div>
  );
}

function ScreenSwitcher({ screen, onChange }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', gap: 3,
      background: 'rgba(28, 24, 16, 0.9)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: 4,
      borderRadius: 999,
      zIndex: 1000,
      boxShadow: '0 8px 24px rgba(0,0,0,.3)',
      maxWidth: 'calc(100vw - 32px)',
      overflowX: 'auto',
    }}>
      {SCREENS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          style={{
            padding: '5px 11px',
            borderRadius: 999,
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: s.id === screen ? '#1a1813' : 'rgba(255,245,220,.7)',
            background: s.id === screen ? '#fff' : 'transparent',
            fontWeight: s.id === screen ? 600 : 500,
            whiteSpace: 'nowrap',
            letterSpacing: 0.2,
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
