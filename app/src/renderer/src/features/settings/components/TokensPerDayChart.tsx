// 일별 토큰 바 차트(0112) — recharts(사용자 승인 의존성, TRD §2). 단일 시리즈라 범례 없음.
// 색은 시맨틱 토큰만 사용한다: 바 = --color-indigo(사용량 지정색, 두 테마 공용), 그리드/축 =
// --color-border, 라벨 = --color-ink3. 툴팁도 Orca 패널 토큰으로 직접 그린다(기본 스타일 미사용).
// 0208 — 툴팁은 날짜·토큰·비용만 낸다. SDK 추정치 안내는 탭 상단 설명 한 곳에만 있다(D-019).

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { UsageStatsDay } from '../../../../../shared/ipc'
import { parseDayKey, totalTokens } from '../../../../../shared/usage/stats'
import { formatMonthDay, useI18n, type UiLocale } from '../../../shared/i18n'
import { fmtUsd, formatTokens } from '../lib/usageFormat'

interface ChartDatum {
  day: string
  ms: number
  tokens: number
  costUsd: number
}

// export = 렌더 테스트가 직접 렌더한다(usageTooltip.render.test.ts). recharts 는 active/payload 를
// 주입하므로 시그니처를 바꾸지 않는다.
export function UsageTooltip({
  active,
  payload,
  locale
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ChartDatum }>
  locale: UiLocale
}): React.JSX.Element | null {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="rounded-r4 border border-border bg-panel px-2.5 py-1.5 shadow-sm">
      <div className="text-[11px] text-ink3">{formatMonthDay(datum.ms, locale)}</div>
      <div className="text-[12.5px] font-medium tabular-nums text-ink">
        {formatTokens(datum.tokens)}
      </div>
      <div className="text-[11px] tabular-nums text-ink3">{fmtUsd(datum.costUsd)}</div>
    </div>
  )
}

export function TokensPerDayChart({
  days,
  ariaLabel
}: {
  days: UsageStatsDay[]
  ariaLabel: string
}): React.JSX.Element {
  const { locale } = useI18n()
  // 배열 identity 를 days 에 고정 — 매 렌더 재생성하면 recharts 가 차트 전체를 재대조한다.
  const data: ChartDatum[] = useMemo(
    () =>
      days.map((d) => ({
        day: d.day,
        ms: parseDayKey(d.day).getTime(),
        tokens: totalTokens(d),
        costUsd: d.totalCostUsd
      })),
    [days]
  )
  return (
    <div role="img" aria-label={ariaLabel} className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="day"
            tickFormatter={(day: string) => formatMonthDay(parseDayKey(day).getTime(), locale)}
            tick={{ fill: 'var(--color-ink3)', fontSize: 10.5 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => formatTokens(v)}
            tick={{ fill: 'var(--color-ink3)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={46}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-bg2)' }}
            content={<UsageTooltip locale={locale} />}
            isAnimationActive={false}
          />
          <Bar
            dataKey="tokens"
            fill="var(--color-indigo)"
            radius={[2, 2, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
