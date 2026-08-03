import { describe, expect, it } from 'vitest'
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../shared/ipc'
import { buildPluginRows } from './pluginCatalog'
describe('plugin catalog', () => {
  it('provider·connector 의 pluginId 합집합을 정렬해 집계한다', () => {
    const providers = [
      { id: 'p', pluginId: 'b' },
      { id: 'q', pluginId: 'b' },
      { id: 'r', pluginId: 'a' }
    ] as AuthProviderInfo[]
    const connectors = [
      { connectorId: 'c', pluginId: 'b', connected: true },
      { connectorId: 'd', pluginId: 'c', connected: false }
    ] as PluginConnectorInfo[]
    expect(
      buildPluginRows(providers, connectors).map(
        ({ pluginId, providerCount, connectorCount, connectedCount }) => ({
          pluginId,
          providerCount,
          connectorCount,
          connectedCount
        })
      )
    ).toEqual([
      { pluginId: 'a', providerCount: 1, connectorCount: 0, connectedCount: 0 },
      { pluginId: 'b', providerCount: 2, connectorCount: 1, connectedCount: 1 },
      { pluginId: 'c', providerCount: 0, connectorCount: 1, connectedCount: 0 }
    ])
  })
  it('입력이 비면 행이 없다', () => expect(buildPluginRows([], [])).toEqual([]))
})
