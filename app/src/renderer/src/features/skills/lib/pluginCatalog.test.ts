import { describe, expect, it } from 'vitest'
import type { AuthProviderInfo, PluginConnectorInfo } from '../../../../../shared/ipc'
import {
  buildConnectorRows,
  connectedAuthLabel,
  connectorAuthLabels,
  providerMap
} from './pluginCatalog'

function provider(id: string, overrides: Partial<AuthProviderInfo> = {}): AuthProviderInfo {
  return {
    id,
    pluginId: 'confluence',
    apiVersion: 1,
    label: id,
    targets: ['connector'],
    mechanisms: ['personal_access_token'],
    capabilities: ['logout'],
    ...overrides
  } as AuthProviderInfo
}

const PROVIDERS = [
  provider('confluence-pat', { label: 'PAT' }),
  provider('confluence-basic', { label: 'ID/비밀번호', mechanisms: ['basic'] })
]

function connector(overrides: Partial<PluginConnectorInfo> = {}): PluginConnectorInfo {
  return {
    connectorId: 'confluence-dc',
    label: 'Confluence',
    origin: 'https://wiki.corp',
    pluginId: 'confluence',
    acceptedAuthProviders: ['confluence-pat', 'confluence-basic'],
    connected: false,
    source: 'static',
    ...overrides
  }
}

describe('buildConnectorRows', () => {
  // 사용자 요구(0164): 빌드타임에 2개를 넣으면 UI 에 2개 항목이 보여야 한다.
  it('커넥터마다 행을 만든다', () => {
    const rows = buildConnectorRows(PROVIDERS, [
      connector(),
      connector({ connectorId: 'confluence-lab', label: '연구소', origin: 'https://rnd.corp' })
    ])
    expect(rows.map((row) => row.connectorId)).toEqual(['confluence-dc', 'confluence-lab'])
  })

  it('행 제목은 서버 라벨, 부제는 주소', () => {
    const [row] = buildConnectorRows(PROVIDERS, [connector({ label: '사내 위키' })])
    expect(row.title).toBe('사내 위키')
    expect(row.origin).toBe('https://wiki.corp')
  })

  // 0159 의 "행 = 패키지" 를 뒤집는 지점 — provider 만 기여하는 패키지는 누를 것이 없다.
  it('provider 전용 패키지는 행이 없다', () => {
    expect(buildConnectorRows(PROVIDERS, [])).toEqual([])
  })

  it('라벨이 비면 connectorId 로 되돌린다', () => {
    const [row] = buildConnectorRows(PROVIDERS, [connector({ label: '   ' })])
    expect(row.title).toBe('confluence-dc')
  })

  it('수용 provider 를 라벨로 푼다', () => {
    const [row] = buildConnectorRows(PROVIDERS, [connector()])
    expect(row.authLabels).toEqual(['PAT', 'ID/비밀번호'])
  })

  it('연결된 provider 를 골라낸다', () => {
    const [row] = buildConnectorRows(PROVIDERS, [
      connector({ connected: true, connectedProviderId: 'confluence-basic' })
    ])
    expect(row.connectedAuthLabel).toBe('ID/비밀번호')
  })

  it('미연결이면 연결 방식이 없다', () => {
    const [row] = buildConnectorRows(PROVIDERS, [connector()])
    expect(row.connectedAuthLabel).toBeNull()
  })

  it('source 와 원본 커넥터를 그대로 나른다', () => {
    const [row] = buildConnectorRows(PROVIDERS, [connector({ source: 'instance' })])
    expect(row.source).toBe('instance')
    expect(row.connector.connectorId).toBe('confluence-dc')
  })
})

describe('connectorAuthLabels', () => {
  // `buildConnectOptions`(연결 시 강제 지점)와 같은 교집합 규칙이어야 한다 — 두 곳이 다르면
  // "고를 수 있다고 써놓고 못 고르는" 화면이 된다.
  it('등록되지 않은 provider 는 빼고, connector target 이 아닌 것도 뺀다', () => {
    const map = providerMap([provider('confluence-pat', { label: 'PAT' })])
    expect(connectorAuthLabels({ acceptedAuthProviders: ['confluence-pat'] }, map)).toEqual(['PAT'])
    expect(connectorAuthLabels({ acceptedAuthProviders: ['missing'] }, map)).toEqual([])

    const appOnly = providerMap([provider('app-sso', { label: 'SSO', targets: ['application'] })])
    expect(connectorAuthLabels({ acceptedAuthProviders: ['app-sso'] }, appOnly)).toEqual([])
  })
})

describe('connectedAuthLabel', () => {
  it('등록 목록에 없는 provider id 는 id 를 그대로 보여준다', () => {
    const map = providerMap([])
    expect(connectedAuthLabel({ connected: true, connectedProviderId: 'gone' }, map)).toBe('gone')
  })

  it('연결됐다고만 하고 provider id 가 없으면 표시하지 않는다', () => {
    expect(connectedAuthLabel({ connected: true }, providerMap(PROVIDERS))).toBeNull()
  })
})
