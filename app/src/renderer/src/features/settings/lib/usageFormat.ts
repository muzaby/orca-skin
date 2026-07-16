// 설정 사용량 표시 헬퍼(0080) — 컴포넌트 파일과 분리해 fast-refresh 경고를 피한다.

import type { AgentEnvironment } from '../../../../../shared/ipc'

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

// 토큰 수 표기(0112) — 기본은 백만 단위 소수 1자리('190.5M', 사용자 요구). 0.1M 미만은
// '0.0M' 이 되지 않도록 천 단위('42.3K')로, 1천 미만은 원시값으로 폴백한다.
export function formatTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n))
}

// provider 표시명 — provider 이름(예: 'bedrock')이 있으면 그것, 없으면 adapter('claude').
export function providerLabel(provider: AgentEnvironment): string {
  return provider.provider ?? provider.adapter
}
