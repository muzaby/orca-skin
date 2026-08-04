// 플러그인 탭 목록의 **행 구성** (0159 → 0164 재정의).
//
// **행 = 커넥터(서버) 하나다.** 0159 는 "행 = 플러그인 패키지" 로 정했고(사용자 결정 ⑦), 그때는
// 한 패키지가 provider 와 connector 를 함께 담는다는 전제가 참이었다(`GLOSSARY.md` §Plugin (C)).
// 0161 이 registry 의 중복 provider id 제약을 피하려고 패키지를 둘로 쪼개면서 그 전제가 깨졌고,
// 화면에는 **누를 것이 없는 provider 전용 행**과 **"인증 제공자 0" 인 서버 행**이 남았다.
// 사용자 지시(2026-08-03): "빌드타임에 2개 등록 → **UI 에 2개 항목이 노출돼야 한다**".
//
// 그래서 단위를 **사용자가 조작하는 대상**으로 바꾼다 — provider 만 기여하는 패키지는 행이
// 아니다(연결할 대상이 없다). provider 는 각 서버 행이 "쓸 수 있는 인증 방식" 으로 흡수한다.

import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../shared/ipc'

export interface ConnectorRow {
  // 선택 키. 0163 까지는 pluginId 였다.
  connectorId: string
  // 서버 이름 — 정적이면 `servers.ts` 의 label, 인스턴스면 사용자가 붙인 이름.
  title: string
  origin: string
  connected: boolean
  source: 'static' | 'instance'
  pluginId: string
  // 이 서버에 쓸 수 있는 인증 방식의 사람용 라벨.
  authLabels: string[]
  // 지금 무엇으로 붙어 있는지. 미연결이면 null.
  connectedAuthLabel: string | null
  connector: PluginConnectorInfo
}

export function buildConnectorRows(
  providers: readonly AuthProviderInfo[],
  connectors: readonly PluginConnectorInfo[]
): ConnectorRow[] {
  const byId = providerMap(providers)
  return [...connectors]
    .sort((a, b) => a.connectorId.localeCompare(b.connectorId))
    .map((connector) => ({
      connectorId: connector.connectorId,
      title: rowTitle(connector),
      origin: connector.origin,
      connected: connector.connected,
      source: connector.source,
      pluginId: connector.pluginId,
      authLabels: connectorAuthLabels(connector, byId),
      connectedAuthLabel: connectedAuthLabel(connector, byId),
      connector
    }))
}

// 이름이 비면 ID 로 되돌린다 — 표시 경로는 죽으면 안 된다.
function rowTitle(connector: PluginConnectorInfo): string {
  const label = (connector.label ?? '').trim()
  return label === '' ? connector.connectorId : label
}

// 수용 선언 ∩ 등록 provider. `buildConnectOptions`(연결 시 강제 지점)와 **같은 교집합 규칙**을
// 표시용으로 재사용한다 — 두 곳이 다른 답을 내면 "고를 수 있다고 써놓고 못 고르는" 화면이 된다.
export function connectorAuthLabels(
  connector: Pick<PluginConnectorInfo, 'acceptedAuthProviders'>,
  byId: ReadonlyMap<string, AuthProviderInfo>
): string[] {
  return connector.acceptedAuthProviders.flatMap((id) => {
    const provider = byId.get(id)
    if (!provider || !provider.targets.includes('connector')) return []
    return [provider.label]
  })
}

export function connectedAuthLabel(
  connector: Pick<PluginConnectorInfo, 'connected' | 'connectedProviderId'>,
  byId: ReadonlyMap<string, AuthProviderInfo>
): string | null {
  if (!connector.connected || connector.connectedProviderId === undefined) return null
  return byId.get(connector.connectedProviderId)?.label ?? connector.connectedProviderId
}

export function providerMap(
  providers: readonly AuthProviderInfo[]
): ReadonlyMap<string, AuthProviderInfo> {
  return new Map(providers.map((provider) => [provider.id, provider]))
}
