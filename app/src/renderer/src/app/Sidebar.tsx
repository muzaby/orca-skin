import { Icon, type IconName } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { Dot } from '../components/atoms/Status'
import { SessionRow } from './SessionRow'
import type { ScreenId } from './screens'
import type { SessionListItem } from '../../../shared/ipc'

export interface SidebarProps {
  active?: ScreenId
  collapsed?: boolean
  onSelect?: (screen: ScreenId) => void
  onNewChat?: () => void
  backendLabel?: string
  backendInstalled?: boolean
  sessions?: SessionListItem[]
  activeSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
}

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

export function Sidebar({
  active = 'chat',
  collapsed = false,
  onSelect,
  onNewChat,
  backendLabel = 'Claude Code',
  backendInstalled = true,
  sessions = [],
  activeSessionId = null,
  onSelectSession,
  onDeleteSession,
  onRenameSession
}: SidebarProps): React.JSX.Element {
  if (collapsed) {
    const icons: IconName[] = ['plus', 'chat', 'folder', 'flask', 'cpu', 'settings']
    return (
      <aside className="flex w-14 flex-none flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
        {icons.map((n, i) => (
          <button
            key={n}
            onClick={() => i === 0 && onNewChat?.()}
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
        <button
          onClick={() => onNewChat?.()}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-2 font-medium text-ink"
        >
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
            </div>
          )
        })}
      </nav>

      <div className={SECTION_HEAD}>최근 대화</div>
      <div className="flex-1 overflow-y-auto px-1.5 pt-1">
        {sessions.length === 0 ? (
          <div className="px-1.5 text-[11.5px] text-ink3">아직 저장된 대화가 없습니다.</div>
        ) : (
          sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
              onRename={onRenameSession}
            />
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <Avatar kind="claude" size={24} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-ink">{backendLabel}</div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-ink3">
            <Dot tone={backendInstalled ? 'green' : 'amber'} />
            {backendInstalled ? '설치됨' : '설치 필요'}
          </div>
        </div>
        <button className="h-[26px] w-[26px] cursor-pointer rounded-md border-0 bg-transparent text-ink3">
          <Icon name="settings" size={14} />
        </button>
      </div>
    </aside>
  )
}
