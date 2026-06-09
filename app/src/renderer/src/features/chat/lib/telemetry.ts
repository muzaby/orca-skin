import type { ProviderReportedTelemetry } from '../../../../../shared/ipc'

// 도넛이 표시하는 "컨텍스트 사용량" 토큰 = 마지막 턴의 input + 프롬프트 캐시(read·creation).
// 마지막 턴에 모델로 들어간 입력 컨텍스트 크기의 근사치. 출력은 제외(다음 턴 입력이 되기 전이라
// 현재 컨텍스트가 아님). 각 필드는 런타임이 일부만 줄 수 있어 optional graceful 합산.
export function contextTokens(t: ProviderReportedTelemetry): number {
  return (t.inputTokens ?? 0) + (t.cacheReadTokens ?? 0) + (t.cacheCreationTokens ?? 0)
}
