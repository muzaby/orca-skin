import { createHash } from 'node:crypto'

export type McpErrorClass =
  'timeout' | 'refused' | 'dns' | 'tls' | 'auth' | 'closed' | 'http' | 'other'
export type ProfileComponent = 'executable' | 'cwd' | `env:${string}` | `config:${string}`
export type ProfileComponents = Partial<Record<ProfileComponent, string>>

export function opaqueIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

export function classifyMcpError(error: string): McpErrorClass {
  if (/timed?\s*out|timeout/i.test(error)) return 'timeout'
  if (/ECONNREFUSED|refused/i.test(error)) return 'refused'
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(error)) return 'dns'
  if (/certificate|self.signed|SSL|TLS|UNABLE_TO_VERIFY/i.test(error)) return 'tls'
  if (/401|403|unauthori|forbidden|OAuth/i.test(error)) return 'auth'
  if (/Connection closed/i.test(error)) return 'closed'
  if (/HTTP|status code/i.test(error)) return 'http'
  return 'other'
}

export function profileComponents(
  executable: string,
  cwd: string,
  environment: NodeJS.ProcessEnv
): ProfileComponents {
  const result: ProfileComponents = {
    executable: opaqueIdentity(executable),
    cwd: opaqueIdentity(cwd)
  }
  const managed: [string, string | undefined][] = []
  for (const [key, value] of Object.entries(environment)) {
    if (key.startsWith('ORCA_MCP_')) managed.push([key, value])
    else result[`env:${key}`] = opaqueIdentity(JSON.stringify(value) ?? 'undefined')
  }
  result['env:ORCA_MCP_*'] = opaqueIdentity(
    JSON.stringify(managed.sort(([a], [b]) => a.localeCompare(b)))
  )
  const content = environment.OPENCODE_CONFIG_CONTENT
  if (content) {
    const config = JSON.parse(content) as Record<string, unknown>
    for (const [key, value] of Object.entries(config))
      result[`config:${key}`] = opaqueIdentity(JSON.stringify(value))
  }
  return result
}

export function diffProfileComponents(
  a: ProfileComponents,
  b: ProfileComponents
): ProfileComponent[] {
  return ([...new Set([...Object.keys(a), ...Object.keys(b)])] as ProfileComponent[])
    .filter((key) => a[key] !== b[key])
    .sort()
}
