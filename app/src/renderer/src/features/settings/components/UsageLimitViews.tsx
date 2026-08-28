// 설정 사용량 공용 뷰(0080) — 전역 '사용량' 탭과 provider별 서브탭이 함께 쓰는 한도 바 +
// 1-depth 지출 한도 편집기. 실사용은 여기서 계산하지 않고 UsageLimitsView 를 참조만 한다.

import { useState } from 'react'
import type { UsageLimitsView, UsageLimitBar } from '../../../../../shared/usage/limits'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Meter } from '../../../shared/ui/Meter'
import { formatResetLabel, useI18n } from '../../../shared/i18n'
import { fmtUsd } from '../lib/usageFormat'

function LimitBarRow({ label, bar }: { label: string; bar: UsageLimitBar }): React.JSX.Element {
  const { tr, locale } = useI18n()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] text-ink">{label}</div>
          <div className="mt-0.5 text-[12px] text-ink3">
            {formatResetLabel(bar.period, bar.resetAt, locale)}
          </div>
        </div>
        <div className="flex-none text-right">
          <div className="text-[12.5px] text-ink2">
            {bar.unlimited
              ? tr('common.unlimited')
              : tr('usage.pctUsed', { pct: Math.round(bar.pct * 100) })}
          </div>
          <div className="mt-0.5 text-[11.5px] tabular-nums text-ink3">
            {fmtUsd(bar.used)}
            {!bar.unlimited && bar.budget != null ? ` / ${fmtUsd(bar.budget)}` : ''}
          </div>
        </div>
      </div>
      {/* 추정치 안내는 여기 붙지 않는다 — 전역 사용량 설명 한 곳이 정본이다(0208 D-019). */}
      <Meter ratio={bar.unlimited ? 0 : bar.pct} tone={bar.unlimited ? 'muted' : undefined} />
    </div>
  )
}

// 주간/월간 한도 바(또는 로딩 문구). usageLimits=null 이면 아직 사용량 미도착.
export function LimitBarsSection({
  usageLimits
}: {
  usageLimits: UsageLimitsView | null
}): React.JSX.Element {
  const { tr } = useI18n()
  if (!usageLimits) {
    return <p className="text-[12.5px] text-ink3">{tr('usage.loading')}</p>
  }
  return (
    <div className="flex flex-col gap-5">
      <LimitBarRow label={tr('usage.weekly')} bar={usageLimits.week} />
      <LimitBarRow label={tr('usage.monthly')} bar={usageLimits.month} />
    </div>
  )
}

// 1-depth 지출 한도 편집기 — $ 입력 + [무제한으로 설정] / [지출 한도 설정].
export function LimitEditor({
  title,
  limit,
  onSave,
  onBack
}: {
  title: string
  limit: number | null
  onSave: (v: number | null) => void
  onBack: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const [draft, setDraft] = useState(limit == null ? '' : String(limit))
  const parsed = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start rounded-r4 bg-transparent px-1 py-0.5 text-[13px] text-ink2 hover:text-ink"
      >
        <Icon name="arrowL" size={15} />
        <span>{tr('usage.backToUsage')}</span>
      </button>

      <div>
        <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] text-ink2">{tr('usage.setLimitDesc')}</p>
      </div>

      <label className="flex items-center gap-2 rounded-r4 border border-border bg-bg px-3 py-2.5 focus-within:border-border-strong">
        <span className="text-[14px] text-ink3">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="90"
          aria-label={tr('usage.limitInputAria')}
          className="min-w-0 flex-1 border-0 bg-transparent text-[14px] tabular-nums text-ink outline-none placeholder:text-ink3"
        />
      </label>
      <p className="text-[12px] text-ink3">{tr('usage.appliesImmediately')}</p>

      <div className="flex justify-end gap-2">
        <Button variant="contained" size="small" onClick={() => onSave(null)}>
          {tr('usage.setUnlimited')}
        </Button>
        <Button variant="primary" size="small" disabled={!valid} onClick={() => onSave(parsed)}>
          {tr('usage.setLimit')}
        </Button>
      </div>
    </div>
  )
}
