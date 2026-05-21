import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { Dot } from '../components/atoms/Status'
import { Popover } from '../components/atoms/Popover'
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

// 한 시점에 한 행만 메뉴 / rename 모드. 각 행이 로컬 state 를 갖고 자기 popover 를
// anchor 한다. Popover atom 의 outside-click 핸들러가 다른 행 클릭 시 자동 닫음.
interface SessionRowProps {
  session: SessionListItem
  isActive: boolean
  onSelect?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  onRename?: (sessionId: string, title: string) => void
}

function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename
}: SessionRowProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const kebabRef = useRef<HTMLButtonElement>(null)

  const label = (session.title?.trim() || session.preview?.trim() || '새 대화').slice(0, 60)

  const startRename = (): void => {
    setMenuOpen(false)
    setRenaming(true)
  }

  const commitRename = (next: string): void => {
    const trimmed = next.trim()
    setRenaming(false)
    if (trimmed === '' || trimmed === label) return
    onRename?.(session.id, trimmed)
  }

  const cancelRename = (): void => {
    setRenaming(false)
  }

  if (renaming) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${
          isActive ? 'bg-black/[0.04] text-ink' : 'text-ink2'
        }`}
      >
        <RenameInput initial={label} onCommit={commitRename} onCancel={cancelRename} />
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelect?.(session.id)}
      className={`group/session relative flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[12px] ${
        isActive ? 'bg-black/[0.04] text-ink' : 'text-ink2'
      }`}
      title={label}
    >
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
      <button
        ref={kebabRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
        className={`h-5 w-5 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink3 hover:text-ink ${
          menuOpen ? 'grid' : 'hidden group-hover/session:grid'
        }`}
        title="더 보기"
        aria-label="세션 메뉴"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <Icon name="kebab" size={14} />
      </button>
      <Popover open={menuOpen} anchorRef={kebabRef} onClose={() => setMenuOpen(false)}>
        <div role="menu" className="flex w-[140px] flex-col py-1">
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              startRename()
            }}
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-ink hover:bg-sidebar"
          >
            <Icon name="edit" size={12} />
            <span>이름 변경</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(false)
              onDelete?.(session.id)
            }}
            className="flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-rust hover:bg-rust-soft"
          >
            <Icon name="trash" size={12} />
            <span>삭제</span>
          </button>
        </div>
      </Popover>
    </div>
  )
}

// 인플레이스 rename input — Enter 저장 / Esc 취소 / blur 저장.
interface RenameInputProps {
  initial: string
  onCommit: (value: string) => void
  onCancel: () => void
}

function RenameInput({ initial, onCommit, onCancel }: RenameInputProps): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onCommit(value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onCommit(value)}
      onClick={(e) => e.stopPropagation()}
      maxLength={120}
      className="w-full rounded border border-border-strong bg-panel px-1.5 py-0.5 text-[12px] text-ink outline-none"
      aria-label="세션 제목 편집"
    />
  )
}
