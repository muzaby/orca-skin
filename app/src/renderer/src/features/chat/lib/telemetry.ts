import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'

// 도넛이 표시하는 "컨텍스트 사용량" 토큰. 다음 턴에 컨텍스트로 실릴 양의 근사치 —
// 마지막 턴의 입력(input) + 프롬프트 캐시(read·creation) + 출력(output)을 합산한다.
// input 만 쓰면 프롬프트 캐싱 활성 시 과소집계되므로 캐시·출력을 포함한다. 각 필드는
// 런타임이 일부만 줄 수 있어 optional graceful 합산.
export function contextTokens(t: ProviderReportedTelemetry): number {
  return (
    (t.inputTokens ?? 0) +
    (t.cacheReadTokens ?? 0) +
    (t.cacheCreationTokens ?? 0) +
    (t.outputTokens ?? 0)
  )
}
