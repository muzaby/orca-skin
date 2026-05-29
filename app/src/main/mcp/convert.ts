// 정규 소스(OrcaMcpConfig) → 백엔드별 타깃 설정 변환기. **양 백엔드 대칭**.
//
// Orca 정규형은 claude-code 스펙이므로(ClaudeMcpConfig = OrcaMcpConfig) Orca→Claude 변환은
// **구조적으로 항등**이고 ${VAR} 확장만 수행한다. 그래도 "변환 불필요 특례"로 두지 않고 명시적
// 변환기(toClaudeConfig)로 존재시킨다 — 어댑터 경계에서 값이 ClaudeMcpConfig 라는 이름으로
// 다뤄지는 지점이자, 향후 소스 스키마가 Claude 형식에서 갈라질 때 차이를 흡수할 자리.
//
// Orca→Opencode 는 구조 변환까지 한다(stdio→local, http/sse→remote). 두 변환기는 동형 시그니처:
//   to<Backend>Config(servers, resolve) → { config: <Backend>McpConfig; dropped }

import { expandEnv, type Resolver } from './expand'
import type { OrcaMcpConfig, ClaudeMcpConfig, OpencodeMcpConfig, OpencodeMcp } from './schema'

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

// OrcaMcpConfig → OpencodeMcpConfig. stdio → local(command 배열), http/sse → remote.
export function toOpencodeConfig(
  servers: OrcaMcpConfig,
  resolve: Resolver
): ConvertResult<OpencodeMcpConfig> {
  const { servers: expanded, dropped } = expandEnv(servers, resolve)
  const config: OpencodeMcpConfig = {}
  for (const [name, s] of Object.entries(expanded)) {
    let item: OpencodeMcp
    if ('url' in s) {
      item = {
        type: 'remote',
        url: s.url,
        ...(s.headers ? { headers: s.headers } : {}),
        enabled: true
      }
    } else {
      item = {
        type: 'local',
        command: [s.command, ...(s.args ?? [])],
        ...(s.env ? { environment: s.env } : {}),
        enabled: true
      }
    }
    config[name] = item
  }
  return { config, dropped }
}
