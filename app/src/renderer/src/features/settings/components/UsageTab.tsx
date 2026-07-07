// 설정 모달 '사용량' 탭 — 실사용 SSOT(costStore)+월 한도로 파생한 주간/월간 한도 바(도넛과
// 동일 함수 computeUsageLimits 결과를 prop 으로 주입받아 참조만)와, "월간 사용 한도" 1-depth
// 조정 뷰. 사용량은 여기서 계산하지 않는다.

import { useState } from 'react'
import { useTweakContext } from '../../../shared/theme'
import type { UsageLimitsView, UsageLimitBar } from '../../../../../shared/usage/limits'
import { Icon } from '../../../shared/ui/Icon'
import { Meter } from '../../../shared/ui/Meter'
import { SettingsGroup } from './parts'

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

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

export function UsageTab({
  usageLimits
}: {
  usageLimits: UsageLimitsView | null
}): React.JSX.Element {
  const { t, setTweak } = useTweakContext()
  const [view, setView] = useState<'root' | 'limit'>('root')

  if (view === 'limit') {
    return (
      <LimitEditor
        limit={t.spendingLimitUsd}
        onSave={(v) => {
          setTweak('spendingLimitUsd', v)
          setView('root')
        }}
        onBack={() => setView('root')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title="사용량 한도">
        {usageLimits ? (
          <div className="flex flex-col gap-5">
            <LimitBarRow label="주간" bar={usageLimits.week} />
            <LimitBarRow label="월간" bar={usageLimits.month} />
          </div>
        ) : (
          <p className="text-[12.5px] text-ink3">사용량 정보를 불러오는 중입니다…</p>
        )}
      </SettingsGroup>

      <section>
        <h3 className="mb-3 text-[15px] font-semibold text-ink">한도 설정</h3>
        <button
          type="button"
          onClick={() => setView('limit')}
          className="flex w-full items-center justify-between gap-4 rounded-r4 border border-border bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-fill-uncontained-hover"
        >
          <div className="min-w-0">
            <div className="text-[13px] text-ink">월간 사용 한도</div>
            <div className="mt-0.5 text-[12px] text-ink3">한 달 지출 한도를 설정합니다</div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span className="text-[12.5px] tabular-nums text-ink2">
              {t.spendingLimitUsd == null ? '무제한' : fmtUsd(t.spendingLimitUsd)}
            </span>
            <Icon name="chevR" size={14} />
          </div>
        </button>
      </section>
    </div>
  )
}

// 1-depth 조정 뷰(첨부 이미지 3 재현) — $ 입력 + [무제한으로 설정] / [지출 한도 설정].
function LimitEditor({
  limit,
  onSave,
  onBack
}: {
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
        <h3 className="text-[16px] font-semibold text-ink">월간 지출 한도 설정</h3>
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
