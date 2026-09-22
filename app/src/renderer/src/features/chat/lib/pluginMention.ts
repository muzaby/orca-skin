import type { ProviderInfo } from '../../../../../shared/ipc'

/** Composer에서 @ 참조할 수 있는 내장 Plugin 후보의 최소 투영. */
export interface PluginMention {
  kind: 'plugin'
  id: string
  label: string
}

/**
 * ProviderInfo의 표시용 label이나 인증 상태를 token으로 재구성하지 않는다.
 * catalog는 네 connection category의 표시 입력이므로 Plugin 자격을 판별하지 않는다.
 * main이 Plugin source에만 싣는 cached `tools`가 있는 행만 내장 Plugin으로 투영한다.
 */
export function pluginMentionCandidates(
  providers: readonly ProviderInfo[],
  partial = ''
): PluginMention[] {
  const query = partial.toLowerCase()
  return providers
    .filter((provider) => provider.tools.length > 0)
    .filter((provider) => provider.id.toLowerCase().startsWith(query))
    .map((provider) => ({ kind: 'plugin' as const, id: provider.id, label: provider.label }))
}
