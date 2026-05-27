import { useCallback, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from '../shared/ui/Icon'
import { useNavigation } from '../shared/navigation'
import { useTweakContext } from '../shared/theme'
import type { ScreenId } from '../shared/types/screen'

interface NavItem {
  i: IconName
  l: string
  screen: ScreenId
}

const NAV: NavItem[] = [
  { i: 'chat', l: '채팅', screen: 'chat' },
  { i: 'folder', l: '프로젝트', screen: 'projects' },
  { i: 'flask', l: '캡처 & 분석', screen: 'captures' },
  { i: 'cpu', l: '엔진 & 모델', screen: 'engine' },
  { i: 'bolt', l: 'Skills & MCP', screen: 'skills' }
]

const SECTION_HEAD =
  'px-3 pb-1 pt-3.5 font-serif text-[11px] font-semibold uppercase tracking-[0.04em] text-ink3'

export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 480
export const SIDEBAR_DEFAULT_WIDTH = 248

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

export interface SidebarProps {
  // '새 대화' 슬롯 — features/chat 의 도메인 버튼.
  newChatSlot: ReactNode
  // '최근 대화' 슬롯 — features/sessions 의 SessionList.
  sessionsSlot: ReactNode
  // footer 슬롯 — features/backend 의 BackendStatus.
  footerSlot: ReactNode
}

// 앱 셸의 sidebar 골격. NavigationContext + TweakContext 만 자체 구독해 collapse /
// resize / NAV 메뉴 / brand 영역을 그린다. 도메인 위젯 (새 대화 / 세션 목록 /
// 백엔드 상태) 은 slot 으로 주입받아 ChatContext 등 도메인 Context 결합을 끊는다.
export function Sidebar({
  newChatSlot,
  sessionsSlot,
  footerSlot
}: SidebarProps): React.JSX.Element {
  const { current, navigate } = useNavigation()
  const { t, setTweak } = useTweakContext()

  const collapsed = t.sidebarCollapsed
  const width = t.sidebarWidth
  const active = current === 'project-detail' ? 'projects' : current

  const asideRef = useRef<HTMLElement>(null)
  const draggingRef = useRef(false)

  const startResize = useCallback(
    (e: React.MouseEvent): void => {
      if (collapsed) return
      e.preventDefault()
      draggingRef.current = true
      const aside = asideRef.current
      if (!aside) return
      const left = aside.getBoundingClientRect().left
      const onMove = (ev: MouseEvent): void => {
        if (!draggingRef.current) return
        const next = clamp(Math.round(ev.clientX - left), SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
        setTweak('sidebarWidth', next)
      }
      const onUp = (): void => {
        draggingRef.current = false
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [collapsed, setTweak]
  )

  if (collapsed) {
    // 접힌 상태에서는 NAV 만 아이콘으로 표시. 도메인 슬롯은 노출하지 않는다.
    const icons: IconName[] = ['plus', 'chat', 'folder', 'flask', 'cpu', 'settings']
    return (
      <aside
        className="app-frame-sidebar relative flex w-14 flex-none flex-col items-center gap-1 border-r border-border bg-sidebar py-3"
        data-behavior="collapsible resizable"
        data-state="collapsed"
      >
        <div className="app-frame-sidebar-body flex flex-col items-center gap-1">
          {icons.map((n, i) => (
            <button
              key={n}
              className={`h-9 w-9 cursor-pointer rounded-lg border-0 ${
                i === 1 ? 'bg-rust-soft text-rust' : 'bg-transparent text-ink2'
              }`}
            >
              <Icon name={n} size={17} />
            </button>
          ))}
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
        <div className="app-frame-sidebar-brand px-3 pb-1.5 pt-2.5">{newChatSlot}</div>

        <nav className="app-frame-sidebar-nav px-1.5 py-1">
          {NAV.map((it) => {
            const isActive = it.screen === active
            return (
              <div
                key={it.i}
                onClick={() => navigate(it.screen)}
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

        <div className="app-frame-sidebar-footer flex items-center gap-2 border-t border-border p-2.5">
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
