import { useI18n } from '../../../shared/i18n'
import { Icon } from '../../../shared/ui/Icon'
import { MODAL_CARD, MODAL_SELECT } from '../../../shared/ui/Modal'
import {
  WEEKDAYS,
  type TimeOfDay,
  type TriggerSpec,
  type Weekday
} from '../../../../../shared/scheduled-tasks'
import { TIME_OPTIONS, timeKey, toggleDay, type ScheduleFormState } from '../lib/scheduleForm'
import { formatTimeOfDay, utcOffsetLabel, WEEKDAY_LABEL_KEYS } from '../lib/triggerLabel'

const FREQUENCY_KEYS = {
  hourly: 'schedules.modal.everyHour',
  daily: 'schedules.modal.everyDay',
  weekly: 'schedules.modal.everyWeek',
  custom: 'schedules.modal.custom'
} as const

// 선택 칩 사이에 놓이는 이음말("요일"·"시각").
const INLINE_WORD = 'text-[13px] text-ink2'

interface TriggerFieldsProps {
  form: Pick<ScheduleFormState, 'triggerKind' | 'day' | 'days' | 'at'>
  onChange: (patch: Partial<ScheduleFormState>) => void
}

// 트리거 카드 — 주기 선택에 따라 요일·시각 입력이 나타난다(매시간은 주기만).
export function TriggerFields({ form, onChange }: TriggerFieldsProps): React.JSX.Element {
  const { tr } = useI18n()
  const timeSelect = (
    <>
      <span className={INLINE_WORD}>{tr('schedules.modal.at')}</span>
      <select
        aria-label={tr('schedules.modal.at')}
        value={timeKey(form.at)}
        onChange={(event) => {
          const at = TIME_OPTIONS.find((option) => timeKey(option) === event.target.value)
          if (at) onChange({ at })
        }}
        className={MODAL_SELECT}
      >
        {withCurrentTime(form.at).map((option) => (
          <option key={timeKey(option)} value={timeKey(option)}>
            {formatTimeOfDay(option)}
          </option>
        ))}
      </select>
      <span className="text-caption text-ink3">{utcOffsetLabel()}</span>
    </>
  )
  return (
    <div data-schedule-trigger="" className={`${MODAL_CARD} p-3.5`}>
      <div className="mb-3 flex items-center gap-2 text-[13.5px] text-ink">
        <Icon name="clock" size={16} className="text-ink2" />
        {tr('schedules.modal.scheduled')}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={tr('schedules.modal.frequency')}
          value={form.triggerKind}
          onChange={(event) => onChange({ triggerKind: event.target.value as TriggerSpec['kind'] })}
          className={MODAL_SELECT}
        >
          {(Object.keys(FREQUENCY_KEYS) as TriggerSpec['kind'][]).map((kind) => (
            <option key={kind} value={kind}>
              {tr(FREQUENCY_KEYS[kind])}
            </option>
          ))}
        </select>
        {form.triggerKind === 'weekly' && (
          <>
            <span className={INLINE_WORD}>{tr('schedules.modal.on')}</span>
            <select
              aria-label={tr('schedules.modal.on')}
              value={form.day}
              onChange={(event) => onChange({ day: Number(event.target.value) as Weekday })}
              className={MODAL_SELECT}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {tr(WEEKDAY_LABEL_KEYS[day])}
                </option>
              ))}
            </select>
          </>
        )}
        {(form.triggerKind === 'daily' || form.triggerKind === 'weekly') && timeSelect}
      </div>
      {form.triggerKind === 'custom' && (
        <div className={`${MODAL_CARD} mt-3 flex flex-col gap-3 p-3`}>
          <span className={INLINE_WORD}>{tr('schedules.modal.repeatWeekly')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={INLINE_WORD}>{tr('schedules.modal.on')}</span>
            <div
              role="group"
              aria-label={tr('schedules.modal.on')}
              data-schedule-days=""
              className="flex gap-0.5 rounded-full border border-border bg-fill-contained-hover p-0.5"
            >
              {WEEKDAYS.map((day) => {
                const on = form.days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    data-schedule-day={day}
                    onClick={() => onChange({ days: toggleDay(form.days, day) })}
                    className={`size-7 rounded-full border text-caption hide-focus-ring ring-focus transition-colors ${
                      on
                        ? 'border-border-strong bg-panel font-medium text-ink'
                        : 'border-transparent text-ink3 hover:text-ink'
                    }`}
                  >
                    {tr(WEEKDAY_LABEL_KEYS[day])}
                  </button>
                )
              })}
            </div>
            {timeSelect}
          </div>
        </div>
      )}
    </div>
  )
}

// 30분 단위가 아닌 저장값(다른 경로로 만든 작업)도 선택지에 보이게 한다.
function withCurrentTime(at: TimeOfDay): readonly TimeOfDay[] {
  return TIME_OPTIONS.some((option) => timeKey(option) === timeKey(at))
    ? TIME_OPTIONS
    : [...TIME_OPTIONS, at].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
}
