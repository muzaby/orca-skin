import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'
import type { UsageLimitsView, UsageLimitBar } from '../../../../../shared/usage/limits'
import { Icon } from '../../../shared/ui/Icon'
import { Meter } from '../../../shared/ui/Meter'
import { contextTokens } from '../lib/telemetry'
import { contextWindowFor, nearCompaction } from '../lib/contextWindow'

interface UsagePanelProps {
  // 마지막 턴의 provider-reported 통계(도넛 트리거가 존재 가드). 컨텍스트 섹션 소스.
  telemetry: ProviderReportedTelemetry
  // 사용량 한도 뷰모델 — 실사용 SSOT(costStore)와 월 한도로 공용 파생(computeUsageLimits).
  // 미도착(cost summary 없음)이면 한도 섹션을 숨긴다.
  usageLimits: UsageLimitsView | null
  // `>` 클릭 — 설정 '사용량' 탭 열기(팝오버 닫기 포함은 호출 측).
  onOpenUsageSettings: () => void
}

function fmtTokens(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : String(v)
}

// 컨텍스트 사용량 패널(도넛 팝오버). 컨텍스트 창(프로그레스바) + 구분선 + 주간/월간 사용량 한도.
// 실사용량은 여기서 계산하지 않는다 — telemetry(컨텍스트)와 usageLimits(한도 파생)를 참조만.
export function UsagePanel({
  telemetry,
  usageLimits,
  onOpenUsageSettings
}: UsagePanelProps): React.JSX.Element {
  const used = contextTokens(telemetry)
  const window = contextWindowFor(telemetry.model)
  const ratio = used / window
  const pct = Math.round(ratio * 100)
  const warn = nearCompaction(used, window)

  return (
    <div className="flex w-[280px] flex-col gap-2.5 p-3" data-context="usage-panel">
      {/* 컨텍스트 창 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-caption text-t6">컨텍스트 창</span>
          <span className="text-caption tabular-nums text-ink2">
            {fmtTokens(used)}/{fmtTokens(window)}
            <span className="ml-1.5 text-ink">{pct}%</span>
          </span>
        </div>
        <Meter ratio={ratio} tone={warn ? 'bad' : undefined} />
      </div>

      {usageLimits && (
        <>
          <div className="border-t border-border" />

          {/* 사용량 한도 헤더 — 우측 `>` 로 설정 사용량 이동 */}
          <button
            type="button"
            onClick={onOpenUsageSettings}
            className="group/limits -mx-1 flex items-center justify-between gap-2 rounded-r4 px-1 py-0.5 text-left hover:bg-fill-uncontained-hover"
            aria-label="사용량 한도 설정 열기"
          >
            <span className="text-caption font-medium text-t6">사용량 한도</span>
            <Icon name="chevR" size={13} />
          </button>

          <LimitRow label="주간" bar={usageLimits.week} />
          <LimitRow label="월간" bar={usageLimits.month} />
        </>
      )}
    </div>
  )
}

function LimitRow({ label, bar }: { label: string; bar: UsageLimitBar }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption text-ink">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-t6">
          {bar.resetLabel}
        </span>
        <span className="flex-none text-caption tabular-nums text-ink">
          {bar.unlimited ? '무제한' : `${Math.round(bar.pct * 100)}%`}
        </span>
      </div>
      <Meter ratio={bar.unlimited ? 0 : bar.pct} tone={bar.unlimited ? 'muted' : undefined} />
    </div>
  )
}
