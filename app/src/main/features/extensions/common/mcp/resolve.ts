import { expandVars, type Resolver } from '../../../../infra/vars'
import type { OrcaMcpConfig } from '../../../../adapters/common/mcp-config'

export interface ResolvedMcpConfig {
  config: OrcaMcpConfig
  dropped: { name: string; reason: string }[]
}
export function resolveMcpConfig(servers: OrcaMcpConfig, resolve: Resolver): ResolvedMcpConfig {
  const config: OrcaMcpConfig = {}
  const dropped: ResolvedMcpConfig['dropped'] = []
  for (const [name, server] of Object.entries(servers)) {
    const missing = new Set<string>()
    const record = 'url' in server ? server.headers : server.env
    const expanded =
      record &&
      Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key, expandVars(value, resolve, missing)])
      )
    if (missing.size) {
      dropped.push({ name, reason: `미해결 환경변수: ${[...missing].join(', ')}` })
      continue
    }
    config[name] =
      'url' in server
        ? { ...server, headers: expanded }
        : { ...server, args: server.args && [...server.args], env: expanded }
  }
  return { config, dropped }
}
