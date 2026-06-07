import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'

interface TelemetryPanelProps {
  // 마지막 턴의 provider-reported 통계. 없으면 패널 자체가 렌더되지 않는다(호출 측 가드).
  telemetry: ProviderReportedTelemetry
  // 세션 내 누적 추정 비용(USD). reducer 가 턴마다 costUsd 를 누산.
  sessionCostUsd?: number
  // app-measured latency(ms) = 전송 → telemetry 도착 벽시계.
  latencyMs?: number
}

// USD 추정 비용 포맷 — 매우 작은 값도 보이도록 4자리(cost-tracking.md 예시와 동일).
function fmtUsd(v: number): string {
  return `$${v.toFixed(4)}`
}

// 토큰 수 — 1k 이상은 k 축약, 그 미만은 원수.
function fmtTokens(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

// ms → 사람이 읽는 시간. 1s 미만은 ms, 그 이상은 s.
function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-g4 px-g2 py-g1">
      <span className="text-caption text-t6">{label}</span>
      <span className="text-caption tabular-nums text-ink">{value}</span>
    </div>
  )
}

// 턴 종료 시 SDK 가 보고한 사용량/비용을 표면화하는 패널 (rendering.md §1.9 TelemetryPanel).
// Composer 풋터의 usage 도넛을 트리거로 Popover 안에 렌더된다. 모든 값은 추정치이며 청구
// 권위가 아니다(cost-tracking.md). 값이 없는 행은 생략해 잡음을 줄인다.
export function TelemetryPanel({
  telemetry,
  sessionCostUsd,
  latencyMs
}: TelemetryPanelProps): React.JSX.Element {
  const t = telemetry
  const models = t.modelUsage ? Object.keys(t.modelUsage) : t.model ? [t.model] : []
  const cacheTotal = (t.cacheReadTokens ?? 0) + (t.cacheCreationTokens ?? 0)

  return (
    <div className="min-w-[220px] px-g1 py-g1" data-context="telemetry-panel">
      <div className="px-g2 pb-g1 pt-g1 text-caption font-medium text-t6">사용량 · 비용 (추정)</div>

      {models.length > 0 && <Row label="모델" value={models.join(', ')} />}

      {t.costUsd != null && <Row label="이번 턴 비용" value={fmtUsd(t.costUsd)} />}
      {sessionCostUsd != null && sessionCostUsd > 0 && (
        <Row label="세션 누적 비용" value={fmtUsd(sessionCostUsd)} />
      )}

      {(t.inputTokens != null || t.outputTokens != null) && (
        <Row
          label="토큰 (입력 / 출력)"
          value={`${fmtTokens(t.inputTokens ?? 0)} / ${fmtTokens(t.outputTokens ?? 0)}`}
        />
      )}
      {cacheTotal > 0 && (
        <Row
          label="캐시 (읽기 / 생성)"
          value={`${fmtTokens(t.cacheReadTokens ?? 0)} / ${fmtTokens(t.cacheCreationTokens ?? 0)}`}
        />
      )}

      {latencyMs != null && <Row label="응답 시간" value={fmtMs(latencyMs)} />}
      {t.durationMs != null && <Row label="엔진 처리 시간" value={fmtMs(t.durationMs)} />}
      {t.numTurns != null && <Row label="단계 수" value={String(t.numTurns)} />}
    </div>
  )
}
