import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'
import { useChatSession } from '../../store/chatStore'
import { TileSection } from './TaskTileSections'

export function TaskScheduleContent(): React.JSX.Element | null {
  const { tr } = useI18n()
  const schedules = useChatSession((session) => session.sessionSchedules)
  const pendingWakeup = useChatSession((session) => session.pendingSessionWakeup)
  if (!schedules?.length && !pendingWakeup) return null
  return (
    <TileSection titleKey="chat.taskTile.sections.scheduled" count={schedules?.length || undefined}>
      <ul className="flex flex-col gap-1 px-2">
        {schedules?.map((schedule) => (
          <li
            key={schedule.id}
            data-session-schedule={schedule.id}
            className="flex min-w-0 items-start gap-3 rounded-r4 px-2 py-2"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-r4 bg-t3 text-ink3">
              <Icon name="clock" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="line-clamp-2 whitespace-pre-wrap break-words text-body text-ink2"
                title={schedule.prompt}
              >
                {schedule.prompt}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-ink3">
                <span>
                  {tr(
                    schedule.recurring
                      ? 'chat.taskTile.scheduled.recurring'
                      : 'chat.taskTile.scheduled.once'
                  )}
                </span>
                <span className="font-mono" title={schedule.schedule}>
                  {schedule.schedule}
                </span>
              </div>
            </div>
          </li>
        ))}
        {pendingWakeup && !schedules?.length && (
          <li
            data-session-wakeup-pending
            className="flex min-w-0 items-start gap-3 rounded-r4 px-2 py-2"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-r4 bg-t3 text-ink3">
              <Icon name="clock" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body text-ink2">{tr('chat.taskTile.scheduled.pendingWakeup')}</p>
              <p className="mt-0.5 text-caption text-ink3">
                {tr('chat.taskTile.scheduled.awaitingDetails')}
              </p>
            </div>
          </li>
        )}
      </ul>
      <p className="px-4 pt-1 text-caption leading-relaxed text-ink3">
        {!!schedules?.length && <>{tr('chat.taskTile.scheduled.lastConfirmed')} </>}
        {tr('chat.taskTile.scheduled.sessionOnly')}
      </p>
    </TileSection>
  )
}
