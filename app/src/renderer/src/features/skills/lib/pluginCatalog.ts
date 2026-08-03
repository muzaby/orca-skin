// Plugin here means a package contribution (meaning C). See docs/GLOSSARY.md §Plugin.
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../shared/ipc'

export interface PluginRow {
  pluginId: string
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
      providerCount: pluginProviders.length,
      connectorCount: pluginConnectors.length,
      connectedCount: pluginConnectors.filter((item) => item.connected).length,
      providers: pluginProviders,
      connectors: pluginConnectors
    }
  })
}
