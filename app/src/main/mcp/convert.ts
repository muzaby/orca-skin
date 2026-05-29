// 정규 소스(OrcaMcpServers) → 백엔드별 타깃 설정 변환기. **양 백엔드 대칭**.
//
// 설계 원칙: Claude 를 "변환 불필요 특례"로 두지 않는다. 두 백엔드 모두 동일한 파이프라인
// (expandEnv → 백엔드별 매핑)을 통과한다. claude-code 변환기는 항등에 가깝지만(소스가 곧
// Claude 스키마), sse→http 정규화·McpServerConfig 셰이핑을 하므로 명시적 함수로 존재한다.
//
// 두 변환기의 시그니처·반환형이 완전 동형:
//   to<Backend>Config(servers, resolve) → { config: Record<string, <Backend>Mcp>; dropped }
// allowedTools(`mcp__<name>__*`)는 config 안에 넣지 않는다 — opencode 와 모양이 어긋나기 때문.
// 호출부(buildQueryOptions)가 Object.keys(config) 로 파생한다.

import { expandEnv, type Resolver } from './expand'
import type {
  OrcaMcpServers,
  ClaudecodeMcpConfig,
  OpencodeMcpConfig,
  ClaudecodeMcp,
  OpencodeMcp
} from './schema'

export interface ConvertResult<C> {
  config: C
  dropped: { name: string; reason: string }[]
}

// claude-code 타깃. 생존 서버를 McpServerConfig 로 (거의 항등) 매핑.
// 프로그래매틱 mcpServers 에서는 'sse' 가 지원되지 않으므로 'http' 로 강제한다(mcp.md L312).
export function toClaudecodeConfig(
  servers: OrcaMcpServers,
  resolve: Resolver
): ConvertResult<ClaudecodeMcpConfig> {
  const { servers: expanded, dropped } = expandEnv(servers, resolve)
  const config: ClaudecodeMcpConfig = {}
  for (const [name, s] of Object.entries(expanded)) {
    let item: ClaudecodeMcp
    if ('url' in s) {
      item = { type: 'http', url: s.url, ...(s.headers ? { headers: s.headers } : {}) }
    } else {
      item = {
        type: 'stdio',
        command: s.command,
        ...(s.args ? { args: s.args } : {}),
        ...(s.env ? { env: s.env } : {})
      }
    }
    config[name] = item
  }
  return { config, dropped }
}

// opencode 타깃. stdio → local(command 배열), http/sse → remote.
export function toOpencodeConfig(
  servers: OrcaMcpServers,
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
