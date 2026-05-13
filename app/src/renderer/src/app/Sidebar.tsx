import { Icon, type IconName } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { Dot } from '../components/atoms/Status'
import type { ScreenId } from './screens'

export interface SidebarProps {
  active?: ScreenId
  collapsed?: boolean
  onSelect?: (screen: ScreenId) => void
}

interface NavItem {
  i: IconName
  l: string
  count?: number
  screen: ScreenId
}

const NAV: NavItem[] = [
  { i: 'chat', l: '채팅', count: 12, screen: 'chat' },
  { i: 'folder', l: '프로젝트', count: 4, screen: 'projects' },
  { i: 'flask', l: '캡처 & 분석', count: 38, screen: 'captures' },
  { i: 'cpu', l: '엔진 & 모델', screen: 'engine' },
  { i: 'bolt', l: 'Skills & MCP', count: 9, screen: 'skills' }
]

const PROJECTS: {
  id: string
  name: string
  engine: 'claude' | 'opencode' | 'local'
  active?: boolean
}[] = [
  { id: 'cam', name: 'cam-validation-v3', engine: 'claude', active: true },
  { id: 'snr', name: 'snr-regression-2026', engine: 'opencode' },
  { id: 'aec', name: 'aec-tuning-suite', engine: 'claude' },
  { id: 'bay', name: 'bayer-debug', engine: 'local' }
]

const RECENT: { id: string; t: string; time: string; active?: boolean }[] = [
  { id: 's1', t: 'Low-light SNR at G2 channel', time: '14m', active: true },
  { id: 's2', t: 'AE convergence delay analysis', time: '2h' },
  { id: 's3', t: 'Capture batch — 240 frames', time: 'Yesterday' },
  { id: 's4', t: 'IR cut filter verification', time: '2d' },
  { id: 's5', t: '센서 EVS 캘리브레이션', time: '4d' }
]

const engineDot = (e: 'claude' | 'opencode' | 'local'): 'green' | 'amber' | 'slate' =>
  e === 'claude' ? 'green' : e === 'opencode' ? 'amber' : 'slate'

const SECTION_HEAD =
  'px-3 pb-1 pt-3.5 font-serif text-[11px] font-semibold uppercase tracking-[0.04em] text-ink3'

export function Sidebar({
  active = 'chat',
  collapsed = false,
  onSelect
}: SidebarProps): React.JSX.Element {
  if (collapsed) {
    const icons: IconName[] = ['plus', 'chat', 'folder', 'flask', 'cpu', 'settings']
    return (
      <aside className="flex w-14 flex-none flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
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
      </aside>
    )
  }

  return (
    <aside className="flex w-[248px] flex-none flex-col border-r border-border bg-sidebar">
      <div className="px-3 pb-1.5 pt-2.5">
        <button className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-2 font-medium text-ink">
          <Icon name="plus" size={14} /> 새 대화
          <span className="ml-auto flex gap-[3px]">
            <span className="kbd text-[10px]">⌘</span>
            <span className="kbd text-[10px]">N</span>
          </span>
        </button>
      </div>

      <nav className="px-1.5 py-1">
        {NAV.map((it) => {
          const isActive = it.screen === active
          return (
            <div
              key={it.i}
              onClick={() => onSelect?.(it.screen)}
              className={`flex cursor-pointer items-center gap-[9px] rounded-md px-2.5 py-1.5 text-[13px] ${
                isActive ? 'bg-black/[0.04] font-medium text-ink' : 'text-ink2'
              }`}
            >
              <Icon name={it.i} size={14} />
              <span>{it.l}</span>
              {it.count != null && (
                <span className="ml-auto text-[11px] tabular-nums text-ink3">{it.count}</span>
              )}
            </div>
          )
        })}
      </nav>

      <div className={SECTION_HEAD}>프로젝트</div>
      <div className="px-1.5">
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-[5px] text-[12.5px] ${
              p.active ? 'bg-rust-soft text-ink' : 'text-ink2'
            }`}
          >
            <Dot tone={engineDot(p.engine)} />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
          </div>
        ))}
      </div>

      <div className={SECTION_HEAD}>최근 대화</div>
      <div className="flex-1 overflow-hidden px-1.5">
        {RECENT.map((s) => (
          <div
            key={s.id}
            className={`cursor-pointer rounded-md px-2.5 py-1.5 ${
              s.active ? 'bg-black/[0.04]' : ''
            }`}
          >
            <div
              className={`overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] ${
                s.active ? 'font-medium text-ink' : 'text-ink2'
              }`}
            >
              {s.t}
            </div>
            <div className="mt-px text-[10.5px] text-ink3">{s.time}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <Avatar kind="claude" size={24} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-ink">Claude Code</div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-ink3">
            <Dot tone="green" /> claude-sonnet-4.5
          </div>
        </div>
        <button className="h-[26px] w-[26px] cursor-pointer rounded-md border-0 bg-transparent text-ink3">
          <Icon name="settings" size={14} />
        </button>
      </div>
    </aside>
  )
}
