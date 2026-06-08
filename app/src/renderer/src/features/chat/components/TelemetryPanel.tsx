import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'
import { contextTokens } from '../lib/telemetry'
import { contextWindowFor, nearCompaction } from '../lib/contextWindow'

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
// /context 와 같은 프레이밍 — 주 표시 `사용 중  used / window (pct%)` + 분해(신규 입력·캐시).
// used = contextTokens = inputTokens + cacheRead + cacheCreation (= /context 분자 정의).
// 작은 inputTokens(캐시 제외 신규 입력)를 컨텍스트 크기로 오해하지 않게 라벨을 명확히 한다.
// (비용/지연/모델은 usage_events 원장으로 옮겨 추후 usage 화면에서 집계.)
export function TelemetryPanel({ telemetry }: TelemetryPanelProps): React.JSX.Element {
  const t = telemetry
  const input = t.inputTokens ?? 0
  const cacheRead = t.cacheReadTokens ?? 0
  const cacheCreation = t.cacheCreationTokens ?? 0
  const window = contextWindowFor(t.model)
  const used = contextTokens(t) // input + cacheRead + cacheCreation
  const pct = Math.round((used / window) * 100)
  const warn = nearCompaction(used, window)

  return (
    <div className="min-w-[220px] px-g1 py-g1" data-context="telemetry-panel">
      <div className="px-g2 pb-g1 pt-g1 text-caption font-medium text-t6">컨텍스트 사용량</div>
      <Row label="사용 중" value={`${fmtTokens(used)} / ${fmtTokens(window)} (${pct}%)`} />
      <Row label="신규 입력(비캐시)" value={fmtTokens(input)} />
      <Row label="캐시 읽기" value={fmtTokens(cacheRead)} />
      {cacheCreation > 0 && <Row label="캐시 생성" value={fmtTokens(cacheCreation)} />}
      {warn && (
        <div className="px-g2 pb-g1 pt-g2">
          <div className="flex items-baseline justify-between gap-g4">
            <span className="text-caption font-medium text-warn">곧 컨텍스트 정리(compaction)</span>
          </div>
          <div className="pt-px text-[10.5px] leading-snug text-t6">
            버퍼·임계는 CLI 버전에 따라 달라지는 추정값입니다.
          </div>
        </div>
      )}
    </div>
  )
}
