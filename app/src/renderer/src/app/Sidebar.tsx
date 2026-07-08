import { memo, useCallback, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../shared/ui/Icon'
import { OrcaLogo } from '../shared/ui/OrcaLogo'
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
  { i: 'cpu', l: '엔진 & 모델', path: '/agent', isActive: (p) => p.startsWith('/agent') },
  { i: 'layers', l: 'Skills & MCP', path: '/skills', isActive: (p) => p.startsWith('/skills') }
]

// Claude Code 사이드바의 "Recents" 헤더 — sans 소문자 그대로, 연한 잉크.
const SECTION_HEAD = 'px-3 pb-1 pt-4 text-caption font-medium text-ink3'

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
        className="app-frame-sidebar effect-primary-elevated relative my-2 ml-2 flex w-14 flex-none flex-col items-center gap-1 rounded-r6 border border-border bg-sidebar py-3"
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
                aria-current={isActive ? 'page' : undefined}
                className={`grid h-9 w-9 place-items-center rounded-r5 border-0 outline-none hide-focus-ring ring-focus transition-colors ${
                  isActive
                    ? 'cursor-default bg-fill-uncontained-active text-t9'
                    : 'cursor-default bg-transparent text-t6 hover:bg-fill-uncontained-hover hover:text-t7'
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
    <>
      <aside
        ref={asideRef}
        // Claude Code 룩: 사이드바는 배경 위에 떠 있는 라운드 카드. 폭 조절 핸들은
        // 카드 바깥(우측 거터)에 형제로 그려져 카드 내부 border·스크롤바와 겹치지 않는다.
        className="app-frame-sidebar effect-primary-elevated my-2 ml-2 flex flex-none flex-col overflow-hidden rounded-r6 border border-border bg-sidebar"
        style={{ width }}
        data-behavior="collapsible resizable"
        data-state="expanded"
      >
        <div className="app-frame-sidebar-body flex min-h-0 flex-1 flex-col">
          <div className="app-frame-sidebar-brand flex items-center gap-2 px-3 pb-1.5 pt-2.5">
            <OrcaLogo className="h-[18px] w-auto flex-none text-ink" />
            <span className="font-serif text-[16px] font-semibold tracking-tight text-ink">
              Orca
            </span>
          </div>

          <nav className="app-frame-sidebar-nav px-1.5 py-1">
            {NAV.map((it) => {
              const isActive = it.isActive(pathname)
              return (
                <button
                  key={it.path}
                  type="button"
                  onClick={() => navigate(it.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-g4 rounded-r4 border-0 px-2.5 py-1.5 text-left text-footnote outline-none hide-focus-ring ring-focus transition-colors ${
                    isActive
                      ? 'cursor-default bg-fill-uncontained-active font-medium text-t9'
                      : 'cursor-default bg-transparent text-t7 hover:bg-fill-uncontained-hover hover:text-t9'
                  }`}
                >
                  <Icon name={it.i} size={14} />
                  <span>{it.l}</span>
                </button>
              )
            })}
          </nav>

          <div className={SECTION_HEAD}>최근 대화</div>
          <div className="app-frame-sidebar-sessions flex-1 overflow-y-auto px-1.5 pt-1">
            {sessionsSlot}
          </div>

          {footerSlot && (
            <div className="app-frame-sidebar-footer flex flex-col gap-1 border-t border-border p-2.5">
              {footerSlot}
            </div>
          )}
        </div>
      </aside>

      {/* 폭 조절 핸들 — 카드 바깥 우측 거터에 형제로 배치. plan 타일 separator 와
          동일한 구조: hover 시 알약 그립(border-strong), press(:active) 중엔 ink3.
          :active 는 mousedown 받은 엘리먼트에 드래그 내내 유지되므로 JS state 불필요. */}
      <div
        className="app-frame-resize-handle group/sep relative w-3 shrink-0 cursor-col-resize"
        data-behavior="resizable"
        data-axis="vertical"
        data-context="sidebar"
        data-state="visible"
        onMouseDown={startResize}
        aria-label="Resize sidebar"
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong opacity-0 transition-opacity duration-150 group-hover/sep:opacity-100 group-active/sep:opacity-100 group-active/sep:bg-ink3"
        />
      </div>
    </>
  )
}

export const Sidebar = memo(SidebarImpl)
