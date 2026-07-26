import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'

// 컨텍스트 윈도우(토큰) 분모 — 1차 소스는 SDK 실측(telemetry.contextWindow, 0134), 아래
// contextWindowFor 는 실측이 없는 경로(세션 재로드 복원 = DB 재조립 telemetry · mock)의 **폴백**이다.
export const DEFAULT_CONTEXT_WINDOW = 200_000

// 1M 컨텍스트 윈도우 마커(부분 문자열 매칭 — bedrock `us.anthropic.…` 같은 프리픽스 변형 커버).
//
// 0149: 이 목록에서 **모델명 추측을 걷어냈다.** SDK 실측 컨텍스트 윈도가 이제
// turn_model_usage.context_window 로 영속되므로(마이그레이션 0016), 재로드 경로도 라이브와 같은
// 실측값을 쓴다 — 신규 모델이 나올 때마다 렌더러 목록을 손으로 갱신할 이유가 사라졌다.
// 남은 것은 실측이 아예 없는 경로(mock 어댑터 · 마이그레이션 이전 행)를 위한 명시적 표기뿐이다.
const WINDOW_1M_MARKERS = ['1m']

export function contextWindowFor(model?: string): number {
  if (!model) return DEFAULT_CONTEXT_WINDOW
  const id = model.toLowerCase()
  return WINDOW_1M_MARKERS.some((marker) => id.includes(marker))
    ? 1_000_000
    : DEFAULT_CONTEXT_WINDOW
}

// 도넛/팝오버 분모 단일 진입점(0134) — 우선순위:
// ① telemetry.contextWindow (단일 모델 턴 top-level 승격값)
// ② modelUsage[telemetry.model].contextWindow (per-model 실측)
// ③ contextWindowFor(model) 모델명 휴리스틱 폴백
// SDK 가 0/음수를 줄 가능성은 > 0 가드로 차단하고 폴백으로 내려간다.
export function contextWindowOf(telemetry: ProviderReportedTelemetry): number {
  const reported =
    telemetry.contextWindow ??
    (telemetry.model !== undefined
      ? telemetry.modelUsage?.[telemetry.model]?.contextWindow
      : undefined)
  if (reported !== undefined && reported > 0) return reported
  return contextWindowFor(telemetry.model)
}

// 자동 compaction 버퍼 — Claude Code 가 컨텍스트 윈도우 끝에서 이만큼을 남겨두고 자동 정리
// (compaction)를 트리거한다. CLI 버전·CLAUDE_AUTOCOMPACT_PCT_OVERRIDE 환경변수에 따라 가변이라
// (과거 ~45k → 현재 ~33k) 정확한 상수가 아닌 추정값이다. /context 와 100% 일치는 불가.
export const AUTOCOMPACT_BUFFER = 33_000

// compaction 임박 여부 — 유효 한계(window - buffer)의 83.5% 를 used 가 넘어서면 곧 자동 정리.
// 윈도우가 버퍼 이하인 비정상 입력(유효 한계 ≤ 0)은 false 가드.
export function nearCompaction(used: number, window: number): boolean {
  const effectiveLimit = window - AUTOCOMPACT_BUFFER
  if (effectiveLimit <= 0) return false
  return used >= effectiveLimit * 0.835
}
