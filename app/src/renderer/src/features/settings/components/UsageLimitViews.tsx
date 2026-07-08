// 설정 사용량 공용 뷰(0080) — 전역 '사용량' 탭과 provider별 서브탭이 함께 쓰는 한도 바 +
// 1-depth 지출 한도 편집기. 실사용은 여기서 계산하지 않고 UsageLimitsView 를 참조만 한다.

import { useState } from 'react'
import type { UsageLimitsView, UsageLimitBar } from '../../../../../shared/usage/limits'
import { Icon } from '../../../shared/ui/Icon'
import { Meter } from '../../../shared/ui/Meter'
import { fmtUsd } from '../lib/usageFormat'

function LimitBarRow({ label, bar }: { label: string; bar: UsageLimitBar }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] text-ink">{label}</div>
          <div className="mt-0.5 text-[12px] text-ink3">{bar.resetLabel}</div>
        </div>
        <div className="flex-none text-right">
          <div className="text-[12.5px] text-ink2">
            {bar.unlimited ? '무제한' : `${Math.round(bar.pct * 100)}% 사용됨`}
          </div>
          <div className="mt-0.5 text-[11.5px] tabular-nums text-ink3">
            {fmtUsd(bar.used)}
            {!bar.unlimited && bar.budget != null ? ` / ${fmtUsd(bar.budget)}` : ''}
          </div>
        </div>
      </div>
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
  if (!usageLimits) {
    return <p className="text-[12.5px] text-ink3">사용량 정보를 불러오는 중입니다…</p>
  }
  return (
    <div className="flex flex-col gap-5">
      <LimitBarRow label="주간" bar={usageLimits.week} />
      <LimitBarRow label="월간" bar={usageLimits.month} />
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
        <span>사용량</span>
      </button>

      <div>
        <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] text-ink2">월별 지출 한도를 설정하세요.</p>
      </div>

      <label className="flex items-center gap-2 rounded-r4 border border-border bg-bg px-3 py-2.5 focus-within:border-border-strong">
        <span className="text-[14px] text-ink3">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="90"
          aria-label="월간 지출 한도 (USD)"
          className="min-w-0 flex-1 border-0 bg-transparent text-[14px] tabular-nums text-ink outline-none placeholder:text-ink3"
        />
      </label>
      <p className="text-[12px] text-ink3">이 지출 한도는 즉시 적용됩니다.</p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onSave(null)}
          className="cursor-pointer rounded-r4 border border-border bg-transparent px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:bg-fill-uncontained-hover"
        >
          무제한으로 설정
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave(parsed)}
          className="cursor-pointer rounded-r4 border-0 bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-t8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          지출 한도 설정
        </button>
      </div>
    </div>
  )
}
