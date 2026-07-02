import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import type { StatusLineModel } from './statusViewModel'

interface StatusPopoverProps {
  id: string
  model: StatusLineModel
  onCompact?: () => void
  onNewChat: () => void
  // 0062 handoff — 새 세션으로 대화 이어가기(즉시 물질화). 미주입 시 버튼 비노출.
  onHandoff?: () => void
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
  onNewChat,
  onHandoff,
  handoffDisabledReason
}: StatusPopoverProps): React.JSX.Element {
  const compactPrimary = model.recommend === 'compact'
  const newChatPrimary = model.recommend === 'newchat'

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
          <div className="text-[13px] font-semibold text-ink">{model.labels.title}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink2">{model.labels.description}</p>
        </div>
      </div>

      <dl className="grid gap-1.5 rounded-r4 border border-border bg-bg/70 p-2 text-[12px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink3">대화 길이</dt>
          <dd className="font-medium text-ink">{model.labels.length}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink3">오늘 사용량</dt>
          <dd className="font-medium text-ink">{model.labels.usage}</dd>
        </div>
        {model.labels.costToday && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink3">오늘 비용</dt>
            <dd className="font-medium text-ink">{model.labels.costToday}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-1.5">
        {onHandoff && (
          <Button
            variant="contained"
            leadingIcon="fork"
            onClick={onHandoff}
            disabled={handoffDisabledReason != null}
            title={handoffDisabledReason ?? '요약본으로 새 세션에서 이어갑니다'}
            className="w-full"
          >
            핸드오프로 이어가기
          </Button>
        )}
        {model.showCompact && model.labels.compactButton && (
          <Button
            variant={compactPrimary ? 'primary' : 'contained'}
            leadingIcon="sparkle"
            onClick={onCompact}
            className="w-full"
          >
            {model.labels.compactButton}
          </Button>
        )}
        <Button
          variant={newChatPrimary ? 'primary' : 'contained'}
          leadingIcon="plus"
          onClick={onNewChat}
          className="w-full"
        >
          {model.labels.newChatButton}
        </Button>
      </div>

      <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-ink3">
        {model.labels.disclaimer}
      </p>
    </div>
  )
}
