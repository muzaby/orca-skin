import { memo, useRef, useState } from 'react'
import { Icon, type IconName } from '../../../shared/ui/Icon'
import { KebabButton } from '../../../shared/ui/KebabButton'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { RenameInput } from '../../../shared/ui/RenameInput'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { useI18n } from '../../../shared/i18n'
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
  // 0129 — 항목 좌측 구분 아이콘. 대화 행은 말풍선(기본), 필요 시 호출자가 교체.
  leadingIcon?: IconName
  // 0129 고정 토글 — 핸들러가 있으면 kebab 에 고정/해제 항목이 나온다. pinned=현재 상태.
  onTogglePin?: (sessionId: string, pinned: boolean) => void
  pinned?: boolean
}

// memo(0108) — 제목 이벤트/목록 재조회가 list 배열 identity 를 갈아도, sessionsStore 의
// in-place 패치가 비변경 항목의 참조를 보존하므로 변경 행만 재렌더된다.
export const SessionRow = memo(function SessionRow({
  session,
  isActive,
  projectName,
  onSelect,
  onDelete,
  onRename,
  renameable = true,
  leadingIcon = 'chat',
  onTogglePin,
  pinned = false
}: SessionRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const kebabRef = useRef<HTMLButtonElement>(null)

  const baseLabel = (
    session.title?.trim() ||
    session.preview?.trim() ||
    tr('common.newChat')
  ).slice(0, 60)
  const label = projectName ? `${projectName} / ${baseLabel}` : baseLabel

  // 메뉴 항목이 하나도 없으면(이름변경 불가 + 삭제 핸들러 없음 — 활성 '새 대화' draft 행)
  // kebab 자체를 렌더하지 않는다(0065). 고정 토글이 있으면 메뉴를 노출한다.
  const hasMenu = renameable || onDelete != null || onTogglePin != null

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
        <Icon name={leadingIcon} size={14} className="shrink-0" />
        <RenameInput
          initial={baseLabel}
          onCommit={commitRename}
          onCancel={cancelRename}
          maxLength={120}
          ariaLabel={tr('sessions.renameAria')}
          autoSize
        />
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
      <Icon name={leadingIcon} size={14} className="shrink-0" />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
      {hasMenu && (
        <>
          <KebabButton
            ref={kebabRef}
            open={menuOpen}
            onToggle={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            revealClass="group-hover/session:grid"
            ariaLabel={tr('sessions.menuAria')}
          />
          <Popover open={menuOpen} anchorRef={kebabRef} onClose={() => setMenuOpen(false)}>
            <div role="menu" className="flex w-[140px] flex-col py-1">
              {onTogglePin != null && (
                <MenuItem
                  role="menuitem"
                  icon="pin"
                  iconSize={12}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onTogglePin(session.id, !pinned)
                  }}
                >
                  <span>{tr(pinned ? 'common.unpin' : 'common.pin')}</span>
                </MenuItem>
              )}
              {renameable && (
                <MenuItem
                  role="menuitem"
                  icon="edit"
                  iconSize={12}
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename()
                  }}
                >
                  <span>{tr('common.rename')}</span>
                </MenuItem>
              )}
              {onDelete != null && (
                <MenuItem
                  role="menuitem"
                  danger
                  icon="trash"
                  iconSize={12}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    openConfirmDialog({
                      title: tr('sessions.deleteDialogTitle'),
                      message: tr('sessions.deleteDialogMessage'),
                      confirmLabel: tr('common.delete'),
                      danger: true,
                      onConfirm: () => onDelete(session.id)
                    })
                  }}
                >
                  <span>{tr('common.delete')}</span>
                </MenuItem>
              )}
            </div>
          </Popover>
        </>
      )}
    </div>
  )
})
