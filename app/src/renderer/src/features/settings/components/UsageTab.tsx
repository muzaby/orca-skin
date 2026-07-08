// 설정 모달 '사용량' 탭(전역/전체) — 실사용 SSOT(costStore)+월 한도로 파생한 주간/월간 한도
// 바(computeUsageLimits 결과를 prop 으로 주입받아 참조만)와, "월간 사용 한도" 1-depth 조정 뷰.
// 사용량은 여기서 계산하지 않는다. 동기화 버튼(0080 항목 2)은 costRefresh 로 주입받는다.

import { useState } from 'react'
import { useTweakContext } from '../../../shared/theme'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import { Icon } from '../../../shared/ui/Icon'
import { SettingsGroup } from './parts'
import { LimitBarsSection, LimitEditor } from './UsageLimitViews'
import { fmtUsd } from '../lib/usageFormat'

export interface CostRefreshView {
  label: string | null
  refreshing: boolean
  onRefresh: () => void
}

// "마지막 업데이트: <라벨> <새로고침 버튼(inflight spin)>" (0080 항목 2). 사용량 한도 하단에 둔다.
export function SyncRow({ label, refreshing, onRefresh }: CostRefreshView): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink3">
      <span>마지막 업데이트: {label ?? '—'}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="사용량 새로고침"
        className="grid h-6 w-6 place-items-center rounded-r4 text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2 disabled:cursor-not-allowed"
      >
        <Icon name="refresh" size={13} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    </div>
  )
}

export function UsageTab({
  usageLimits,
  costRefresh
}: {
  usageLimits: UsageLimitsView | null
  costRefresh: CostRefreshView
}): React.JSX.Element {
  const { t, setTweak } = useTweakContext()
  const [view, setView] = useState<'root' | 'limit'>('root')

  if (view === 'limit') {
    return (
      <LimitEditor
        title="월간 지출 한도 설정"
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
        <div className="flex flex-col gap-4">
          <LimitBarsSection usageLimits={usageLimits} />
          <SyncRow {...costRefresh} />
        </div>
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
