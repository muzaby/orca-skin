import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import type { SessionListItem } from '../../../../../shared/ipc'

// 한 시점에 한 행만 메뉴 / rename 모드. 각 행이 로컬 state 를 갖고 자기 popover 를
// anchor 한다. Popover atom 의 outside-click 핸들러가 다른 행 클릭 시 자동 닫음.
// Sidebar 와 ProjectDetailScreen 양쪽에서 재사용 (kebab/rename/delete UX 통일).
export interface SessionRowProps {
  session: SessionListItem
  isActive: boolean
  // 프로젝트 소속 세션일 때만 truthy. label 에 `<projectName> / ` prefix 가 붙는다.
  // ProjectDetail 의 내부 대화 리스트처럼 이미 프로젝트 컨텍스트가 명확한 곳에서는
  // 의도적으로 비워둔다.
  projectName?: string | null
  onSelect?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  onRename?: (sessionId: string, title: string) => void
  // continuity draft(미물질화, 0064 r4) 행은 rename 불가 — 마커 제목이 main 의 initialTitle
  // 에서 오므로 draft 단계 rename 은 물질화 시 덮여 유실된다. 메뉴에서 항목을 숨긴다.
  renameable?: boolean
}

export function SessionRow({
  session,
  isActive,
  projectName,
  onSelect,
  onDelete,
  onRename,
  renameable = true
}: SessionRowProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const kebabRef = useRef<HTMLButtonElement>(null)

  const baseLabel = (session.title?.trim() || session.preview?.trim() || '새 대화').slice(0, 60)
  const label = projectName ? `${projectName} / ${baseLabel}` : baseLabel

  const startRename = (): void => {
    setMenuOpen(false)
    setRenaming(true)
  }

  const commitRename = (next: string): void => {
    const trimmed = next.trim()
    setRenaming(false)
    // prefix(projectName) 는 lookup 으로 합성된 값이므로 비교는 baseLabel 기준.
    if (trimmed === '' || trimmed === baseLabel) return
    onRename?.(session.id, trimmed)
  }

  const cancelRename = (): void => {
    setRenaming(false)
  }

  if (renaming) {
    return (
      <div
        className={`app-frame-session-row flex items-center gap-1.5 rounded-md px-2 py-[5px] text-[12.5px] ${
          isActive ? 'bg-fill-uncontained-active text-ink' : 'text-t7'
        }`}
        data-context="session"
        data-state={isActive ? 'active' : 'inactive'}
        data-behavior="interactive renaming"
        data-session-id={session.id}
      >
        <RenameInput initial={baseLabel} onCommit={commitRename} onCancel={cancelRename} />
      </div>
    )
  }

  return (
    <div
      onClick={() => onSelect?.(session.id)}
      className={`app-frame-session-row group/session relative flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-[5px] text-[12.5px] transition-colors ${
        isActive ? 'bg-fill-uncontained-active text-ink' : 'text-t7 hover:bg-fill-uncontained-hover'
      }`}
      data-context="session"
      data-state={isActive ? 'active' : 'inactive'}
      data-behavior="interactive selectable"
      data-session-id={session.id}
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
          {renameable && (
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
          )}
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
