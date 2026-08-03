// Plugin here means a package contribution (meaning C). See docs/GLOSSARY.md §Plugin.
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../shared/ipc'

export interface PluginRow {
  pluginId: string
  // 목록에 보여줄 이름 (0163). 인스턴스 행의 `pluginId` 는 주소에서 파생한 기계값
  // (`confluence-wiki-corp`)이라 사용자가 붙인 이름이 어디에도 안 보였다.
  title: string
  providerCount: number
  connectorCount: number
  connectedCount: number
  providers: AuthProviderInfo[]
  connectors: PluginConnectorInfo[]
}

export function buildPluginRows(
  providers: AuthProviderInfo[],
  connectors: PluginConnectorInfo[]
): PluginRow[] {
  const ids = new Set([
    ...providers.map((item) => item.pluginId),
    ...connectors.map((item) => item.pluginId)
  ])
  return [...ids].sort().map((pluginId) => {
    const pluginProviders = providers.filter((item) => item.pluginId === pluginId)
    const pluginConnectors = connectors.filter((item) => item.pluginId === pluginId)
    return {
      pluginId,
      title: rowTitle(pluginId, pluginProviders, pluginConnectors),
      providerCount: pluginProviders.length,
      connectorCount: pluginConnectors.length,
      connectedCount: pluginConnectors.filter((item) => item.connected).length,
      providers: pluginProviders,
      connectors: pluginConnectors
    }
  })
}

// 사용자가 붙인 이름을 쓸 **근거가 있을 때만** 쓴다 — provider 를 기여하지 않고 커넥터가
// 정확히 하나인 행이 그것이다(템플릿 인스턴스의 형상). 그 외에는 이름을 지어낼 근거가 없어
// pluginId 를 유지한다.
function rowTitle(
  pluginId: string,
  providers: readonly AuthProviderInfo[],
  connectors: readonly PluginConnectorInfo[]
): string {
  if (providers.length > 0 || connectors.length !== 1) return pluginId
  // `?? ''` 는 방어다 — 표시 경로라 DTO 가 라벨을 빠뜨려도 화면이 죽으면 안 된다.
  const label = (connectors[0].label ?? '').trim()
  return label === '' ? pluginId : label
}

export function pluginRowTitle(row: PluginRow): string {
  return row.title
}
