import { useRef, useState } from 'react'
import type { ScheduledRun, ScheduledTask } from '../../../../../shared/scheduled-tasks'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { Toggle } from '../../../shared/ui/Toggle'
import { formatDateTime, triggerSummary } from '../lib/triggerLabel'
import { RunHistoryPanel } from './RunHistory'

function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="mb-g1 text-caption text-ink3">{label}</div>
      <div className="truncate text-footnote text-ink2" title={value}>
        {value}
      </div>
    </div>
  )
}

interface ScheduleDetailProps {
  task: ScheduledTask
  // null = 프로젝트가 삭제됨.
  projectName: string | null
  revision: number
  loadRuns: (taskId: string) => Promise<ScheduledRun[]>
  onSetEnabled: (enabled: boolean) => void
  onRunNow: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenSession: (sessionId: string) => void
}

// 우측 상세 패널의 본문 — 머리줄(제목·사용 토글·메뉴) · 메타 · 명령 · 실행 이력.
export function ScheduleDetail({
  task,
  projectName,
  revision,
  loadRuns,
  onSetEnabled,
  onRunNow,
  onEdit,
  onDelete,
  onOpenSession
}: ScheduleDetailProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const command = task.action.kind === 'prompt' ? task.action.text : task.action.command
  const nextRun = task.running
    ? tr('schedules.running')
    : !task.enabled
      ? tr('schedules.paused')
      : task.nextRunAt != null
        ? formatDateTime(task.nextRunAt, locale)
        : '—'
  const closeMenu = (): void => {
    setMenuOpen(false)
    menuRef.current?.focus({ preventScroll: true })
  }

  return (
    <div data-schedule-detail={task.id} className="min-w-0 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 min-w-0 break-words text-heading text-ink">{task.title}</h2>
        <div className="ml-auto flex items-center gap-2">
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
            onClick={() => setMenuOpen((open) => !open)}
          />
          <Popover
            open={menuOpen}
            anchorRef={menuRef}
            onClose={() => setMenuOpen(false)}
            placement="bottom"
            align="end"
            className="min-w-36"
          >
            <MenuItem
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
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
        <Meta label={tr('schedules.modal.trigger')} value={triggerSummary(task.trigger, tr)} />
        <Meta
          label={tr('schedules.modal.project')}
          value={projectName ?? tr('schedules.projectMissing')}
        />
        <Meta label={tr('schedules.detail.nextRun')} value={nextRun} />
        <Meta
          label={tr('schedules.modal.command')}
          value={tr(task.action.kind === 'prompt' ? 'schedules.kindPrompt' : 'schedules.kindShell')}
        />
      </div>

      <pre
        data-schedule-detail-command=""
        className={`mt-5 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-r6 border border-border bg-bg px-3.5 py-3 text-footnote leading-[1.6] text-ink ${
          task.action.kind === 'shell' ? 'font-mono' : 'font-sans'
        }`}
      >
        {command}
      </pre>

      <div className="mt-6">
        <div className="mb-2 text-footnote text-ink2">{tr('schedules.history.title')}</div>
        <div className="-mx-3">
          <RunHistoryPanel
            taskId={task.id}
            revision={revision}
            loadRuns={loadRuns}
            onOpenSession={onOpenSession}
          />
        </div>
      </div>
    </div>
  )
}
