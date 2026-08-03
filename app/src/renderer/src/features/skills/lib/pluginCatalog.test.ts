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

// 0163 — 인스턴스 행의 pluginId 는 주소에서 파생한 기계값(`confluence-wiki-corp`)이라
// 사용자가 붙인 이름이 목록 어디에도 안 보였다.
describe('행 제목', () => {
  const instance = [
    { connectorId: 'confluence-wiki-corp', pluginId: 'confluence-wiki-corp', label: '사내 위키' }
  ] as PluginConnectorInfo[]

  it('인스턴스 행은 사용자가 붙인 이름을 제목으로 쓴다', () => {
    expect(buildPluginRows([], instance)[0].title).toBe('사내 위키')
  })

  it('근거가 없으면 pluginId 를 제목으로 유지한다', () => {
    // provider 를 기여하는 행(공용 패키지)은 서버 이름이랄 것이 없다.
    const providers = [{ id: 'p', pluginId: 'confluence' }] as AuthProviderInfo[]
    expect(buildPluginRows(providers, [])[0].title).toBe('confluence')

    // 커넥터가 여럿인 행(정적 패키지)도 어느 이름을 쓸지 정할 근거가 없다.
    const many = [
      { connectorId: 'x', pluginId: 'confluence', label: 'A' },
      { connectorId: 'y', pluginId: 'confluence', label: 'B' }
    ] as PluginConnectorInfo[]
    expect(buildPluginRows([], many)[0].title).toBe('confluence')
  })

  it('라벨이 비면 pluginId 로 되돌린다', () => {
    const blank = [
      { connectorId: 'z', pluginId: 'confluence-wiki-corp', label: '   ' }
    ] as PluginConnectorInfo[]
    expect(buildPluginRows([], blank)[0].title).toBe('confluence-wiki-corp')
  })
})
