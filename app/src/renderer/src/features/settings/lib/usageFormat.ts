// 설정 사용량 표시 헬퍼(0080) — 컴포넌트 파일과 분리해 fast-refresh 경고를 피한다.

import type { AgentEnvironment } from '../../../../../shared/ipc'

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

// provider 표시명 — provider 이름(예: 'bedrock')이 있으면 그것, 없으면 adapter('claude').
export function providerLabel(provider: AgentEnvironment): string {
  return provider.provider ?? provider.adapter
}
