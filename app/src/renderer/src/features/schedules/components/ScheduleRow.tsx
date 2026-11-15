import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { CatalogListRow } from '../../../shared/ui/CatalogListRow'
import { Icon } from '../../../shared/ui/Icon'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { Toggle } from '../../../shared/ui/Toggle'
import type { ScheduledTask } from '../../../../../shared/scheduled-tasks'
import { formatDateTime, triggerSummary } from '../lib/triggerLabel'

interface ScheduleRowProps {
  task: ScheduledTask
  // null = 프로젝트가 삭제됨.
  projectName: string | null
  expanded: boolean
  onToggleExpanded: () => void
  onSetEnabled: (enabled: boolean) => void
  onRunNow: () => void
  onEdit: () => void
  onDelete: () => void
  // 펼쳤을 때의 실행 이력.
  children?: ReactNode
}

export function ScheduleRow({
  task,
  projectName,
  expanded,
  onToggleExpanded,
  onSetEnabled,
  onRunNow,
  onEdit,
  onDelete,
  children
}: ScheduleRowProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const frame = window.requestAnimationFrame(() =>
      firstRef.current?.focus({ preventScroll: true })
    )
    return () => window.cancelAnimationFrame(frame)
  }, [menuOpen])
  const closeMenu = (): void => {
    setMenuOpen(false)
    menuRef.current?.focus({ preventScroll: true })
  }
  const schedule = task.running
    ? tr('schedules.running')
    : !task.enabled
      ? tr('schedules.paused')
      : task.nextRunAt != null
        ? tr('schedules.nextRun', { time: formatDateTime(task.nextRunAt, locale) })
        : null
  return (
    <>
      <CatalogListRow
        data-schedule-row={task.id}
        data-schedule-enabled={task.enabled}
        selected={expanded}
        openProps={{ onClick: onToggleExpanded, 'aria-expanded': expanded }}
        icon={
          <Icon
            name={task.action.kind === 'shell' ? 'terminal2' : 'chat'}
            size={20}
            className={`shrink-0 ${task.enabled ? 'text-ink3' : 'text-ink3 opacity-50'}`}
          />
        }
        title={
          <span className={`truncate ${task.enabled ? '' : 'text-ink3'}`} title={task.title}>
            {task.title}
          </span>
        }
        detail={
          <span className="flex min-w-0 flex-wrap gap-x-2 text-caption text-ink3">
            <span>{triggerSummary(task.trigger, tr)}</span>
            {projectName != null ? (
              <span className="truncate">{projectName}</span>
            ) : (
              <span data-schedule-project-missing="" className="text-danger">
                {tr('schedules.projectMissing')}
              </span>
            )}
            {schedule && <span data-schedule-next="">{schedule}</span>}
            {task.lastRun?.status === 'error' && (
              <span className="text-danger">{tr('schedules.history.statusError')}</span>
            )}
          </span>
        }
        actions={
          <>
            <Toggle
              on={task.enabled}
              label={tr('schedules.enableAria', { title: task.title })}
              onClick={() => onSetEnabled(!task.enabled)}
            />
            <Button
              ref={menuRef}
              iconOnly
              size="small"
              leadingIcon="kebab"
              title={tr('common.more')}
              aria-label={tr('schedules.itemMenu', { title: task.title })}
              aria-haspopup="menu"
              expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setMenuOpen(true)
                }
              }}
            />
            <Popover
              open={menuOpen}
              anchorRef={menuRef}
              onClose={closeMenu}
              placement="bottom"
              align="end"
              className="min-w-36"
            >
              <MenuItem
                ref={firstRef}
                role="menuitem"
                icon="play"
                disabled={task.running}
                onClick={() => {
                  closeMenu()
                  onRunNow()
                }}
              >
                {tr('schedules.runNow')}
              </MenuItem>
              <MenuItem
                role="menuitem"
                icon="edit"
                onClick={() => {
                  closeMenu()
                  onEdit()
                }}
              >
                {tr('common.edit')}
              </MenuItem>
              <MenuItem
                role="menuitem"
                icon="trash"
                onClick={() => {
                  closeMenu()
                  onDelete()
                }}
              >
                {tr('common.delete')}
              </MenuItem>
            </Popover>
          </>
        }
      />
      {expanded && <li className="list-none">{children}</li>}
    </>
  )
}
