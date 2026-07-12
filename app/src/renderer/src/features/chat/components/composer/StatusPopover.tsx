import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import type { StatusLineModel } from './statusViewModel'

interface StatusPopoverProps {
  id: string
  model: StatusLineModel
  // 0064 r2 — 단계별 단일 권장 액션: warn=현재 세션 /compact 전송, danger=핸드오프.
  onCompact: () => void
  onHandoff: () => void
  handoffDisabledReason?: string | null
}

const TONE_CLASS: Record<StatusLineModel['state'], string> = {
  warn: 'text-warn bg-warn/10',
  danger: 'text-bad bg-bad/10'
}

export function StatusPopover({
  id,
  model,
  onCompact,
  onHandoff,
  handoffDisabledReason
}: StatusPopoverProps): React.JSX.Element {
  const { tr } = useI18n()
  const isHandoff = model.action === 'handoff'

  return (
    <div id={id} role="none" className="flex w-[320px] flex-col gap-3 p-3">
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${TONE_CLASS[model.state]}`}
          aria-hidden
        >
          <Icon name="alert" size={14} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">{tr(model.labelKeys.title)}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink2">
            {tr(model.labelKeys.description)}
          </p>
        </div>
      </div>

      <dl className="grid gap-1.5 rounded-r4 border border-border bg-bg/70 p-2 text-[12px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink3">{tr('chat.status.lengthLabel')}</dt>
          <dd className="font-medium text-ink">{tr(model.labelKeys.length)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink3">{tr('chat.status.usageTodayLabel')}</dt>
          <dd className="font-medium text-ink">{tr(model.labelKeys.usage)}</dd>
        </div>
        {model.costToday && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink3">{tr('chat.status.costTodayLabel')}</dt>
            <dd className="font-medium text-ink">{model.costToday}</dd>
          </div>
        )}
      </dl>

      <Button
        variant="primary"
        leadingIcon={isHandoff ? 'fork' : 'sparkle'}
        onClick={isHandoff ? onHandoff : onCompact}
        disabled={isHandoff && handoffDisabledReason != null}
        title={
          isHandoff
            ? (handoffDisabledReason ?? tr('chat.status.handoffHint'))
            : tr('chat.status.compactHint')
        }
        className="w-full"
      >
        {tr(model.labelKeys.actionButton)}
      </Button>

      <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-ink3">
        {tr(model.labelKeys.disclaimer)}
      </p>
    </div>
  )
}
