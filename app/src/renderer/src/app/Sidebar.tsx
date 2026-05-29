import { memo, useCallback, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../shared/ui/Icon'
import { useTweakContext } from '../shared/theme'
import { useDragResize } from '../shared/hooks/useDragResize'

interface NavItem {
  i: IconName
  l: string
  path: string
  // pathname prefix 매칭으로 active 판정. `/projects` 와 `/projects/:id` 모두 활성,
  // `/new` 와 `/chat/:sessionId` 모두 활성 — `isActive(pathname)` 가 그 차이를 흡수.
  isActive: (pathname: string) => boolean
}

const NAV: NavItem[] = [
  { i: 'plus', l: '새 대화', path: '/new', isActive: (p) => p === '/new' },
  { i: 'folder', l: '프로젝트', path: '/projects', isActive: (p) => p.startsWith('/projects') },
  { i: 'clock', l: '자동화', path: '/routines', isActive: (p) => p.startsWith('/routines') },
  { i: 'layers', l: 'Skills & MCP', path: '/skills', isActive: (p) => p.startsWith('/skills') }
]

const SECTION_HEAD =
  'px-3 pb-1 pt-3.5 font-serif text-[11px] font-semibold uppercase tracking-[0.04em] text-ink3'

// sidebar 의 *도메인 특정* 설정값. 공용 인프라가 아니라 sidebar 자체 책임이므로
// 일반 useDragResize 훅이 아닌 이 파일에 둔다.
export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 480
export const SIDEBAR_DEFAULT_WIDTH = 248

export interface SidebarProps {
  // '최근 대화' 슬롯 — features/sessions 의 SessionList.
  sessionsSlot: ReactNode
  // footer 슬롯 — features/backend 의 BackendStatus.
  footerSlot: ReactNode
}

// 앱 셸의 sidebar 골격. router pathname + TweakContext 를 자체 구독해 collapse /
// resize / NAV 메뉴 / brand 영역을 그린다. 도메인 위젯 (새 대화 / 세션 목록 /
// 백엔드 상태) 은 slot 으로 주입받아 ChatContext 등 도메인 Context 결합을 끊는다.
// 드래그 메커니즘은 shared/hooks/useDragResize 에 위임; 여기서는 sidebar 측의
// 설정값 (SIDEBAR_*) 과 적용 (setTweak('sidebarWidth', n)) 만 책임진다.
// React.memo: slot ReactNode 가 부모에서 안정적으로 전달되는 한 router/TweakContext
// 변경 시에만 리렌더 (FRONTEND_ARCHITECTURE §3.A).
function SidebarImpl({ sessionsSlot, footerSlot }: SidebarProps): React.JSX.Element {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { t, setTweak } = useTweakContext()

  const collapsed = t.sidebarCollapsed
  const width = t.sidebarWidth

  const asideRef = useRef<HTMLElement>(null)

  const handleWidthChange = useCallback(
    (n: number): void => setTweak('sidebarWidth', n),
    [setTweak]
  )
  const getOrigin = useCallback(
    (): number => asideRef.current?.getBoundingClientRect().left ?? 0,
    []
  )
  const { startResize } = useDragResize({
    getOrigin,
    min: SIDEBAR_MIN_WIDTH,
    max: SIDEBAR_MAX_WIDTH,
    disabled: collapsed,
    onChange: handleWidthChange
  })

  if (collapsed) {
    // 접힌 상태에서는 NAV 만 아이콘으로 표시. 도메인 슬롯은 노출하지 않는다.
    return (
      <aside
        className="app-frame-sidebar relative flex w-14 flex-none flex-col items-center gap-1 border-r border-border bg-sidebar py-3"
        data-behavior="collapsible resizable"
        data-state="collapsed"
      >
        <div className="app-frame-sidebar-body flex flex-col items-center gap-1">
          {NAV.map((it) => {
            const isActive = it.isActive(pathname)
            return (
              <button
                key={it.path}
                onClick={() => navigate(it.path)}
                aria-label={it.l}
                className={`h-9 w-9 cursor-pointer rounded-lg border-0 ${
                  isActive ? 'bg-rust-soft text-rust' : 'bg-transparent text-ink2'
                }`}
              >
                <Icon name={it.i} size={17} />
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside
      ref={asideRef}
      className="app-frame-sidebar relative flex flex-none flex-col border-r border-border bg-sidebar"
      style={{ width }}
      data-behavior="collapsible resizable"
      data-state="expanded"
    >
      <div className="app-frame-sidebar-body flex min-h-0 flex-1 flex-col">
        <div className="app-frame-sidebar-brand flex items-center gap-2 px-3 pb-1.5 pt-2.5">
          <span className="text-[18px] leading-none" aria-hidden>
            🐋
          </span>
          <span className="font-serif text-[15px] font-semibold tracking-tight text-ink">Orca</span>
        </div>

        <nav className="app-frame-sidebar-nav px-1.5 py-1">
          {NAV.map((it) => {
            const isActive = it.isActive(pathname)
            return (
              <div
                key={it.path}
                onClick={() => navigate(it.path)}
                className={`flex cursor-pointer items-center gap-[9px] rounded-md px-2.5 py-1.5 text-[13px] ${
                  isActive ? 'bg-black/[0.04] font-medium text-ink' : 'text-ink2'
                }`}
              >
                <Icon name={it.i} size={14} />
                <span>{it.l}</span>
              </div>
            )
          })}
        </nav>

        <div className={SECTION_HEAD}>최근 대화</div>
        <div className="app-frame-sidebar-sessions flex-1 overflow-y-auto px-1.5 pt-1">
          {sessionsSlot}
        </div>

        <div className="app-frame-sidebar-footer flex flex-col gap-1 border-t border-border p-2.5">
          {footerSlot}
        </div>
      </div>

      <div
        className="app-frame-resize-handle absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-border-strong"
        data-behavior="resizable"
        data-axis="vertical"
        data-context="sidebar"
        data-state="visible"
        onMouseDown={startResize}
        aria-label="Resize sidebar"
      />
    </aside>
  )
}

export const Sidebar = memo(SidebarImpl)
