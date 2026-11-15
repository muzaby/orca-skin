import { useI18n } from '../../../shared/i18n'
import { Icon } from '../../../shared/ui/Icon'
import { MenuChip } from '../../../shared/ui/MenuChip'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { MODAL_CARD } from '../../../shared/ui/Modal'
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
const FREQUENCIES = Object.keys(FREQUENCY_KEYS) as TriggerSpec['kind'][]

// 선택 칩 사이에 놓이는 이음말("요일"·"시각").
const INLINE_WORD = 'text-footnote text-ink2'

interface ChoiceChipProps<T> {
  title: string
  marker: string
  value: T
  options: readonly T[]
  keyOf: (option: T) => string
  labelOf: (option: T) => string
  onPick: (option: T) => void
}

// 값 하나를 고르는 칩 — 메뉴는 현재 값에 체크가 붙은 한 줄 목록이다.
function ChoiceChip<T>({
  title,
  marker,
  value,
  options,
  keyOf,
  labelOf,
  onPick
}: ChoiceChipProps<T>): React.JSX.Element {
  return (
    <span data-schedule-choice={marker} className="inline-flex">
      <MenuChip title={title} label={labelOf(value)}>
        {(close) => (
          <div role="none" className="flex max-h-[260px] min-w-[132px] flex-col overflow-y-auto">
            {options.map((option) => {
              const active = keyOf(option) === keyOf(value)
              return (
                <MenuItem
                  key={keyOf(option)}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onPick(option)
                    close()
                  }}
                >
                  <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                    {labelOf(option)}
                  </span>
                  {active && <Icon name="check" size={12} />}
                </MenuItem>
              )
            })}
          </div>
        )}
      </MenuChip>
    </span>
  )
}

interface TriggerFieldsProps {
  form: Pick<ScheduleFormState, 'triggerKind' | 'day' | 'days' | 'at'>
  onChange: (patch: Partial<ScheduleFormState>) => void
}

// 트리거 카드 — 주기 선택에 따라 요일·시각 입력이 나타난다(매시간은 주기만).
export function TriggerFields({ form, onChange }: TriggerFieldsProps): React.JSX.Element {
  const { tr } = useI18n()
  const timeChoice = (
    <>
      <span className={INLINE_WORD}>{tr('schedules.modal.at')}</span>
      <ChoiceChip
        title={tr('schedules.modal.at')}
        marker="time"
        value={form.at}
        options={withCurrentTime(form.at)}
        keyOf={timeKey}
        labelOf={formatTimeOfDay}
        onPick={(at) => onChange({ at })}
      />
      <span className="text-caption text-ink3">{utcOffsetLabel()}</span>
    </>
  )
  return (
    <div data-schedule-trigger="" className={`${MODAL_CARD} p-3.5`}>
      <div className="mb-3 flex items-center gap-2 text-body text-ink">
        <Icon name="clock" size={16} className="text-ink2" />
        {tr('schedules.modal.scheduled')}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceChip
          title={tr('schedules.modal.frequency')}
          marker="frequency"
          value={form.triggerKind}
          options={FREQUENCIES}
          keyOf={(kind) => kind}
          labelOf={(kind) => tr(FREQUENCY_KEYS[kind])}
          onPick={(triggerKind) => onChange({ triggerKind })}
        />
        {form.triggerKind === 'weekly' && (
          <>
            <span className={INLINE_WORD}>{tr('schedules.modal.on')}</span>
            <ChoiceChip<Weekday>
              title={tr('schedules.modal.on')}
              marker="day"
              value={form.day}
              options={WEEKDAYS}
              keyOf={String}
              labelOf={(day) => tr(WEEKDAY_LABEL_KEYS[day])}
              onPick={(day) => onChange({ day })}
            />
          </>
        )}
        {(form.triggerKind === 'daily' || form.triggerKind === 'weekly') && timeChoice}
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
            {timeChoice}
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
