// 정규 소스(OrcaMcpConfig) → 백엔드별 타깃 설정 변환기.
//
// Orca 정규형은 claude 스펙이므로(ClaudeMcpConfig = OrcaMcpConfig) Orca→Claude 변환은
// **구조적으로 항등**이고 ${VAR} 확장만 수행한다. 그래도 "변환 불필요 특례"로 두지 않고 명시적
// 변환기(toClaudeConfig)로 존재시킨다 — 어댑터 경계에서 값이 ClaudeMcpConfig 라는 이름으로
// 다뤄지는 지점이자, 향후 소스 스키마가 Claude 형식에서 갈라질 때 차이를 흡수할 자리.

import { expandEnv, type Resolver } from '../infra/vars'
import type { OrcaMcpConfig, ClaudeMcpConfig } from './schema'

export interface ConvertResult<C> {
  config: C
  dropped: { name: string; reason: string }[]
}

// OrcaMcpConfig → ClaudeMcpConfig. 동형이므로 ${VAR} 확장 결과가 곧 Claude 타깃.
export function toClaudeConfig(
  servers: OrcaMcpConfig,
  resolve: Resolver
): ConvertResult<ClaudeMcpConfig> {
  const { servers: expanded, dropped } = expandEnv(servers, resolve)
  return { config: expanded, dropped }
}
