// Confluence Data Center 플러그인 패키지 (0160) — provider 2 + connector N + runtime tools N.
//
// 서버 목록을 받아 패키지를 조립한다. 같은 factory 를 다른 `id`·`baseUrl` 로 부르면 서버가
// 늘어난다 — core 코드는 손대지 않는다(0158 `createJiraConnector` 선례).
//
// manifest 는 구현 descriptor 에서 **파생**한다. 손으로 두 벌 적으면 registry 의 전 필드
// 동등 검사에서 갈리고, 그 순간 패키지 전체가 거부된다.

import type { ConnectorRuntimeV1 } from '../../../../contracts/connector-plugin'
import type { RuntimeToolContribution } from '../../../../adapters/runtime-tools'
import type { ConnectorTemplate } from '../../../../contracts/connector-template'
import { createBasicCredentialProvider } from '../../providers/basic-credential'
import { createStaticCredentialProvider } from '../../providers/static-credential'
import type { AuthPluginPackage } from '../index'
import {
  createConfluenceConnector,
  CONFLUENCE_BASIC_PROVIDER_ID,
  CONFLUENCE_PAT_PROVIDER_ID,
  CONFLUENCE_PLUGIN_ID,
  type ConfluenceServerConfig
} from './connector'
import { createConfluenceTools } from './tools'

export {
  CONFLUENCE_BASIC_PROVIDER_ID,
  CONFLUENCE_PAT_PROVIDER_ID,
  CONFLUENCE_PLUGIN_ID,
  type ConfluenceServerConfig
} from './connector'
export { CONFLUENCE_SERVERS } from './servers'
export { CONFLUENCE_TOOL_NAMES, confluenceToolServerId } from './tools'

// ── 템플릿 (0161) ────────────────────────────────────────────────────────────
//
// 사용자가 UI 에서 서버를 추가하는 경로. 위 `createConfluencePackage`(코드 레벨 정적 등록)는
// 그대로 남고 두 경로가 공존한다(사용자 결정 2026-08-03).
//
// **패키지를 둘로 나누는 이유**: registry 가 중복 provider id 를 거부하므로 인스턴스마다
// provider 를 함께 등록하면 두 번째 서버 추가가 통째로 실패한다. provider 는 shared 에 1회,
// connector+tools 만 인스턴스마다 등록한다.
export const confluenceTemplate: ConnectorTemplate = {
  id: CONFLUENCE_PLUGIN_ID,
  i18nKey: 'skills.templates.confluence',
  fields: [
    { name: 'label', required: true, i18nKey: 'skills.instance.label' },
    {
      name: 'baseUrl',
      required: true,
      i18nKey: 'skills.instance.baseUrl',
      placeholder: 'https://wiki.example.com'
    },
    {
      name: 'apiBasePath',
      required: false,
      i18nKey: 'skills.instance.apiBasePath',
      placeholder: '/confluence'
    }
  ],

  sharedPackage: () => ({
    manifest: {
      schemaVersion: 1,
      id: CONFLUENCE_PLUGIN_ID,
      version: '1.0.0',
      contributes: { authProviders: confluenceProviderDeclarations() }
    },
    providers: confluenceProviders()
  }),

  instancePackage: (config) => {
    const server: ConfluenceServerConfig = {
      id: config.connectorId,
      label: config.label,
      baseUrl: config.baseUrl,
      ...(config.apiBasePath !== undefined ? { apiBasePath: config.apiBasePath } : {})
    }
    const connector = createConfluenceConnector(server)
    const tools = createConfluenceTools(config.connectorId, config.label)
    return {
      manifest: {
        schemaVersion: 1,
        // 인스턴스마다 고유 pluginId — registry 가 중복 manifest.id 를 거부하고
        // `descriptor.pluginId === manifest.id` 를 강제한다.
        id: config.connectorId,
        version: '1.0.0',
        contributes: {
          connectors: [connectorDeclaration(connector)],
          runtimeTools: [runtimeToolDeclaration(tools)]
        }
      },
      connectors: [
        { ...connector, descriptor: { ...connector.descriptor, pluginId: config.connectorId } }
      ],
      runtimeTools: [
        { ...tools, descriptor: { ...tools.descriptor, pluginId: config.connectorId } }
      ]
    }
  }
}

function connectorDeclaration(connector: ConnectorRuntimeV1): Record<string, unknown> {
  const { descriptor } = connector
  return {
    id: descriptor.id,
    apiVersion: descriptor.apiVersion,
    label: descriptor.label,
    acceptedAuthProviders: [...descriptor.acceptedAuthProviders],
    baseUrl: descriptor.baseUrl,
    presentation: descriptor.presentation,
    presentations: descriptor.presentations
  }
}

function runtimeToolDeclaration(contribution: RuntimeToolContribution): Record<string, unknown> {
  const { descriptor } = contribution
  return {
    id: descriptor.id,
    connectorId: descriptor.connectorId,
    apiVersion: descriptor.apiVersion,
    tools: descriptor.tools
  }
}

function confluenceProviderDeclarations(): Record<string, unknown>[] {
  return [
    {
      id: CONFLUENCE_PAT_PROVIDER_ID,
      apiVersion: 1,
      label: 'Confluence PAT',
      targets: ['connector'],
      mechanisms: ['personal_access_token'],
      capabilities: ['logout']
    },
    {
      id: CONFLUENCE_BASIC_PROVIDER_ID,
      apiVersion: 1,
      label: 'Confluence ID/비밀번호',
      targets: ['connector'],
      mechanisms: ['basic'],
      capabilities: ['logout']
    }
  ]
}

function confluenceProviders(): AuthPluginPackage['providers'] {
  return [
    // PAT 는 단일 opaque 값이라 static-credential 을 그대로 쓴다. **probeUrl 을 주지 않는다** —
    // 검증은 connector.start() 가 실제 요청 경로로 한다(provider 는 origin 을 모른다).
    createStaticCredentialProvider({
      id: CONFLUENCE_PAT_PROVIDER_ID,
      pluginId: CONFLUENCE_PLUGIN_ID,
      label: 'Confluence PAT',
      mechanism: 'personal_access_token',
      service: 'confluence',
      fieldLabel: '개인 액세스 토큰(PAT)',
      // **연결 전용이다** — 위 선언(`targets: ['connector']`)과 같아야 한다. 기본값
      // (`['application','connector']`)을 쓰면 이 패키지를 켜는 것만으로 prod 앱 로그인
      // 게이트가 켜진다(0164 verify D1 — DEV bypass 때문에 개발 중에는 보이지 않는다).
      targets: ['connector']
    }),
    createBasicCredentialProvider({
      id: CONFLUENCE_BASIC_PROVIDER_ID,
      pluginId: CONFLUENCE_PLUGIN_ID,
      label: 'Confluence ID/비밀번호',
      service: 'confluence'
    })
  ]
}

export function createConfluencePackage(
  servers: readonly ConfluenceServerConfig[]
): AuthPluginPackage {
  const connectors: ConnectorRuntimeV1[] = servers.map(createConfluenceConnector)
  const runtimeTools: RuntimeToolContribution[] = servers.map((server) =>
    createConfluenceTools(server.id, server.label)
  )

  return {
    manifest: {
      schemaVersion: 1,
      id: CONFLUENCE_PLUGIN_ID,
      version: '1.0.0',
      contributes: {
        authProviders: confluenceProviderDeclarations(),
        // 선언은 구현에서 파생한다 — 두 벌을 손으로 맞추면 반드시 갈린다.
        connectors: connectors.map(({ descriptor }) => ({
          id: descriptor.id,
          apiVersion: descriptor.apiVersion,
          label: descriptor.label,
          acceptedAuthProviders: [...descriptor.acceptedAuthProviders],
          baseUrl: descriptor.baseUrl,
          presentation: descriptor.presentation,
          presentations: descriptor.presentations
        })),
        runtimeTools: runtimeTools.map(({ descriptor }) => ({
          id: descriptor.id,
          connectorId: descriptor.connectorId,
          apiVersion: descriptor.apiVersion,
          tools: descriptor.tools
        }))
      }
    },
    providers: confluenceProviders(),
    connectors,
    runtimeTools
  }
}
