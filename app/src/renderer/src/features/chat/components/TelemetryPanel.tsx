import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'
import { contextTokens } from '../lib/telemetry'
import { contextWindowFor } from '../lib/contextWindow'

interface TelemetryPanelProps {
  // 마지막 턴의 provider-reported 통계. 없으면 패널 자체가 렌더되지 않는다(호출 측 가드).
  telemetry: ProviderReportedTelemetry
}

// 토큰 수 — 1k 이상은 k 축약, 그 미만은 원수.
function fmtTokens(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-g4 px-g2 py-g1">
      <span className="text-caption text-t6">{label}</span>
      <span className="text-caption tabular-nums text-ink">{value}</span>
    </div>
  )
}

// 컨텍스트 사용량 패널 (rendering.md §1.9). Composer 풋터의 usage 도넛을 클릭하면 Popover 로 뜬다.
// 마지막 턴 기준 컨텍스트 4항목만 표시: 누적 입력 토큰 · 캐시 · 컨텍스트 윈도우 · 사용량%.
// (비용/지연/모델은 usage_events 원장으로 옮겨 추후 usage 화면에서 집계.)
export function TelemetryPanel({ telemetry }: TelemetryPanelProps): React.JSX.Element {
  const t = telemetry
  const input = t.inputTokens ?? 0
  const cache = (t.cacheReadTokens ?? 0) + (t.cacheCreationTokens ?? 0)
  const window = contextWindowFor(t.model)
  const used = contextTokens(t) // input + cache
  const pct = Math.round((used / window) * 100)

  return (
    <div className="min-w-[220px] px-g1 py-g1" data-context="telemetry-panel">
      <div className="px-g2 pb-g1 pt-g1 text-caption font-medium text-t6">컨텍스트 사용량</div>
      <Row label="입력 토큰 (마지막 턴 누적)" value={fmtTokens(input)} />
      <Row label="캐시" value={fmtTokens(cache)} />
      <Row label="컨텍스트 윈도우" value={fmtTokens(window)} />
      <Row label="사용량" value={`${pct}%`} />
    </div>
  )
}
