import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../shared/ipc'

/** Sources stay contiguous; equal labels keep their first-seen source order. */
export function orderSkills(skills: readonly SkillInfo[]): SkillInfo[] {
  const bySource = new Map<string, SkillInfo[]>()
  for (const skill of skills) {
    const rows = bySource.get(skill.sourceId)
    if (rows) rows.push(skill)
    else bySource.set(skill.sourceId, [skill])
  }
  return [...bySource.values()]
    .sort((a, b) => a[0].sourceLabel.localeCompare(b[0].sourceLabel))
    .flat()
}

export function orderMcpServers(servers: readonly McpServer[]): McpServer[] {
  return [
    ...servers.filter((server) => server.enabled),
    ...servers.filter((server) => !server.enabled)
  ]
}

export function orderProviders(providers: readonly ProviderInfo[]): ProviderInfo[] {
  return [
    ...providers.filter((provider) => provider.kind === 'gate'),
    ...providers.filter((provider) => provider.kind === 'llm'),
    ...providers.filter((provider) => provider.kind === 'service')
  ]
}
