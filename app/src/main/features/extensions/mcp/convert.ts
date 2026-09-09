// MCP 소스를 Claude 설정으로 준비한다. 구조는 동형이며 env/header 변수만 확장한다.
// 미해결 변수가 있으면 해당 서버 전체를 제외한다. 문자열 치환은 infra가 소유한다.
import { expandVars, type Resolver } from '../../../infra/vars'
import type { OrcaMcpConfig, ClaudeMcpConfig, ClaudeMcp } from '../../../adapters/mcp-config'

interface ConvertResult {
  config: ClaudeMcpConfig
  dropped: { name: string; reason: string }[]
}

function expandRecord(
  record: Record<string, string> | undefined,
  resolve: Resolver,
  missing: Set<string>
): Record<string, string> | undefined {
  if (!record) return record
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) out[key] = expandVars(value, resolve, missing)
  return out
}

export function toClaudeConfig(servers: OrcaMcpConfig, resolve: Resolver): ConvertResult {
  const config: ClaudeMcpConfig = {}
  const dropped: ConvertResult['dropped'] = []
  for (const [name, server] of Object.entries(servers)) {
    const missing = new Set<string>()
    const expanded: ClaudeMcp =
      'url' in server
        ? { ...server, headers: expandRecord(server.headers, resolve, missing) }
        : { ...server, env: expandRecord(server.env, resolve, missing) }
    if (missing.size > 0) {
      dropped.push({ name, reason: `미해결 환경변수: ${[...missing].join(', ')}` })
      continue
    }
    config[name] = expanded
  }
  return { config, dropped }
}
