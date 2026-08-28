// 설정 모달 '사용량' 탭(전역) — 사용량 요약(0112): 기간 탭(최근 7일/30일/전체)별 일별 토큰
// 차트 + 모델별 내역. 데이터는 main 의 turn_usage/turn_model_usage 집계(costUsageStats).
// 주기적 실행 설정 그룹(0099)은 0112 에서 제거 — main 스케줄러/tweak 스키마는 유지된다.
// SyncRow/CostRefreshView 는 provider 서브탭이 재사용하므로 여기 정의를 유지한다.

import { useMemo, useState } from 'react'
import type { UsageStatsModel, UsageStatsRange } from '../../../../../shared/ipc'
import {
  WEEKLY_AGGREGATION_THRESHOLD_DAYS,
  aggregateWeekly,
  fillDailySeries,
  totalTokens
} from '../../../../../shared/usage/stats'
import { Icon } from '../../../shared/ui/Icon'
import { Meter } from '../../../shared/ui/Meter'
import { useI18n } from '../../../shared/i18n'
import { useUsageStats } from '../hooks/useUsageStats'
import { fmtUsd, formatTokens } from '../lib/usageFormat'
import { SettingsGroup } from './parts'
import { TokensPerDayChart } from './TokensPerDayChart'

export interface CostRefreshView {
  label: string | null
  refreshing: boolean
  onRefresh: () => void
}

// "마지막 업데이트: <라벨> <새로고침 버튼(inflight spin)>" (0080). provider 서브탭이 재사용.
export function SyncRow({ label, refreshing, onRefresh }: CostRefreshView): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div className="flex items-center gap-2 text-[12px] text-ink3">
      <span>
        {tr('usage.lastUpdated')}: {label ?? '—'}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={tr('usage.refreshAria')}
        className="grid h-6 w-6 place-items-center rounded-r4 text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2 disabled:cursor-not-allowed"
      >
        <Icon name="refresh" size={13} className={refreshing ? 'animate-spin' : undefined} />
      </button>
    </div>
  )
}

// 기간 탭 라벨은 언어 전환 시 stale 해지지 않도록 키만 상수로 두고 렌더에서 tr() 해석.
const RANGES = [
  { id: '7d', labelKey: 'settings.usage.range7d' },
  { id: '30d', labelKey: 'settings.usage.range30d' },
  { id: 'all', labelKey: 'settings.usage.rangeAll' }
] as const satisfies readonly { id: UsageStatsRange; labelKey: string }[]

// 세그먼티드 기간 탭 — 공용 Tabs 프리미티브가 없어 SettingsModal 내비 선택 패턴을 따른다.
function RangeTabs({
  value,
  onChange
}: {
  value: UsageStatsRange
  onChange: (next: UsageStatsRange) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div role="tablist" className="flex gap-1 self-start rounded-r4 border border-border p-0.5">
      {RANGES.map((r) => {
        const active = value === r.id
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.id)}
            className={`cursor-pointer rounded-r3 border-0 px-2.5 py-1 text-[12px] transition-colors ${
              active
                ? 'bg-selected-soft font-medium text-selected'
                : 'bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2'
            }`}
          >
            {tr(r.labelKey)}
          </button>
        )
      })}
    </div>
  )
}

// 모델별 내역 — 총 토큰 내림차순, 최대 모델 대비 비율 Meter(차트와 같은 indigo 톤).
// export = 렌더 테스트가 직접 렌더한다(usageTooltip.render.test.ts).
export function ModelUsageList({ models }: { models: UsageStatsModel[] }): React.JSX.Element {
  const { tr } = useI18n()
  const top = models.length > 0 ? totalTokens(models[0]) : 0
  return (
    <div className="flex flex-col gap-4">
      {models.map((m) => {
        const total = totalTokens(m)
        return (
          <div key={m.model}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate font-mono text-[12px] text-ink">{m.model}</span>
              <span className="flex-none text-[12.5px] tabular-nums text-ink2">
                {formatTokens(total)}
              </span>
            </div>
            <Meter
              ratio={top > 0 ? total / top : 0}
              tone="info"
              className="mt-1.5"
              title={tr('usage.estimateNote')}
            />
            <div className="mt-1 text-[11.5px] tabular-nums text-ink3">
              {tr('settings.usage.modelBreakdown', {
                input: formatTokens(m.inputTokens),
                output: formatTokens(m.outputTokens),
                cache: formatTokens(m.cacheCreationInputTokens + m.cacheReadInputTokens),
                cost: fmtUsd(m.costUsd)
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 전역 사용량 요약(0112) — /cost 유사 요약의 실구현.
export function UsageTab(): React.JSX.Element {
  const { tr } = useI18n()
  const [range, setRange] = useState<UsageStatsRange>('7d')
  const { stats, loading } = useUsageStats(range)

  // days 는 희소(사용 있던 날만) — 여기서 연속 일자로 제로필한다. '전체' 범위가 표시 임계를
  // 넘으면 주 단위(월요일 시작)로 접는다(표시 전용, 합계/모델 내역은 영향 없음).
  // 제로필은 최대 MAX_FILLED_DAYS 행을 만들므로 파생값 일체를 stats/range 에 memo 한다
  // (fillDailySeries 의 now 는 stats.updatedAt 고정 — 입력이 같으면 결과도 같다).
  const { series, weekly, grandTotal, totalCost } = useMemo(() => {
    const filled = stats ? fillDailySeries(stats.days, stats.since, stats.updatedAt) : []
    const weekly = range === 'all' && filled.length > WEEKLY_AGGREGATION_THRESHOLD_DAYS
    return {
      series: weekly ? aggregateWeekly(filled) : filled,
      weekly,
      grandTotal: stats?.days.reduce((acc, d) => acc + totalTokens(d), 0) ?? 0,
      totalCost: stats?.days.reduce((acc, d) => acc + d.totalCostUsd, 0) ?? 0
    }
  }, [stats, range])
  const empty = !loading && stats != null && stats.days.length === 0 && stats.models.length === 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{tr('settings.usage.title')}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{tr('settings.usage.desc')}</p>
      </div>

      <RangeTabs value={range} onChange={setRange} />

      {loading && <p className="text-[12.5px] text-ink3">{tr('usage.loading')}</p>}

      {empty && (
        <div className="flex flex-col items-center gap-1.5 rounded-r4 border border-dashed border-border px-4 py-8 text-center">
          <Icon name="chart" size={20} className="text-ink3" />
          <div className="text-[13px] font-medium text-ink2">{tr('settings.usage.empty')}</div>
          <p className="text-[12px] text-ink3">{tr('settings.usage.emptyDesc')}</p>
        </div>
      )}

      {!loading && stats != null && !empty && (
        <>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-semibold tabular-nums text-ink">
                {formatTokens(grandTotal)}
              </span>
              <span className="text-[12px] text-ink3">{tr('settings.usage.totalTokens')}</span>
            </div>
            <div className="mt-0.5 text-[12px] tabular-nums text-ink3">
              {tr('settings.usage.totalCost')}: {fmtUsd(totalCost)}
            </div>
          </div>

          <SettingsGroup title={tr('settings.usage.dailyTokens')}>
            <TokensPerDayChart days={series} ariaLabel={tr('settings.usage.chartAria')} />
            {weekly && <p className="text-[11.5px] text-ink3">{tr('settings.usage.weeklyNote')}</p>}
          </SettingsGroup>

          <SettingsGroup title={tr('settings.usage.byModel')}>
            <ModelUsageList models={stats.models} />
          </SettingsGroup>
        </>
      )}
    </div>
  )
}
